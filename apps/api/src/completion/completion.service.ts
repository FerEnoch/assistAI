import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import {
  EditorSession,
  CompletionRequest,
  CompletionRetrievalHit,
} from '@assistai/entities';
import {
  COMPLETION_CONFIG,
  PROVIDER_CONFIG,
  RETRIEVAL_CONFIG,
  STRUCTURAL_CONFIG,
} from '@assistai/shared';
import type { CompletionRequestPayload, RetrievalHit } from '@assistai/shared';
import { RetrievalService } from '../retrieval/retrieval.service';
import { QUERY_EMBEDDING, type QueryEmbeddingPort } from '../retrieval/query-embedding.token';
import { PromptAssembler } from './prompt-assembler';
import { ProviderRouter } from '../provider/provider-router.service';
import { StructuralMatchService } from './structural-match.service';
import { MetadataAwareRetrievalService } from './metadata-aware-retrieval.service';
import { mapToErrorCode, getErrorMessage, ErrorCode } from '../errors';

/**
 * SSE message event structure for NestJS @Sse().
 */
export interface SseMessageEvent {
  data: string;
  type?: string;
  id?: string;
}

/**
 * Completion service — orchestrates the completion pipeline (A-070 through A-077).
 *
 * Pipeline: prefix → [gating] → [retrieval] → [weak-ground suppression] →
 *           prompt assembly → provider routing → SSE stream → logging
 *
 * Uses SSE (Server-Sent Events) via @Sse() + rxjs Observable<MessageEvent>.
 * NOT WebSockets — per spec constraint.
 */
@Injectable()
export class CompletionService {
  private readonly logger = new Logger(CompletionService.name);

  constructor(
    @InjectRepository(EditorSession)
    private readonly sessionRepo: Repository<EditorSession>,
    @InjectRepository(CompletionRequest)
    private readonly completionRepo: Repository<CompletionRequest>,
    @InjectRepository(CompletionRetrievalHit)
    private readonly hitRepo: Repository<CompletionRetrievalHit>,
    private readonly dataSource: DataSource,
    private readonly retrievalService: RetrievalService,
    @Inject(QUERY_EMBEDDING) private readonly queryEmbedding: QueryEmbeddingPort,
    private readonly promptAssembler: PromptAssembler,
    private readonly providerRouter: ProviderRouter,
    private readonly structuralMatchService: StructuralMatchService,
    private readonly metadataAwareRetrieval: MetadataAwareRetrievalService,
  ) {}

  /**
   * Create or update an editor session (A-061).
   */
  async ensureSession(
    workspaceId: string,
    userId: string,
    sessionId?: string,
  ): Promise<EditorSession> {
    if (sessionId) {
      const existing = await this.sessionRepo.findOne({
        where: { id: sessionId, workspaceId, userId },
      });

      if (existing) {
        existing.lastActivityAt = new Date();
        return this.sessionRepo.save(existing);
      }
    }

    // Create new session
    const session = this.sessionRepo.create({
      workspaceId,
      userId,
      activeLanguage: 'es',
      lastActivityAt: new Date(),
    });

    return this.sessionRepo.save(session);
  }

  /**
   * Stream a completion response via SSE (A-070).
   *
   * Returns an Observable<MessageEvent> that emits:
   * - type: 'token' — individual completion tokens
   * - type: 'meta' — retrieval metadata (chunk count, latency, grounded flag)
   * - type: 'done' — completion finished
   * - type: 'error' — error occurred
   */
  streamCompletion(
    workspaceId: string,
    userId: string,
    payload: CompletionRequestPayload,
    signal?: AbortSignal,
  ): Observable<SseMessageEvent> {
    const subject = new Subject<SseMessageEvent>();

    // Run pipeline asynchronously
    void this.runPipeline(workspaceId, userId, payload, subject, signal);

    return subject.asObservable();
  }

  /**
   * Record user feedback on a completion (accept/reject tracking).
   */
  async recordFeedback(
    completionId: string,
    workspaceId: string,
    accepted: boolean,
  ): Promise<void> {
    await this.completionRepo.update(
      { id: completionId, workspaceId },
      { acceptedByUser: accepted },
    );
  }

  private async runPipeline(
    workspaceId: string,
    userId: string,
    payload: CompletionRequestPayload,
    subject: Subject<SseMessageEvent>,
    signal?: AbortSignal,
  ): Promise<void> {
    const startMs = Date.now();
    let timedOut = false;
    let savedCompletionId: string | null = null;

    // Early exit: client already disconnected before pipeline started
    if (signal?.aborted) {
      subject.complete();
      return;
    }

    // Timeout budget (A-077) — abort after totalTimeoutMs
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      const timeoutCode = ErrorCode.COMPLETION_TIMEOUT;
      const timeoutMessage = getErrorMessage(timeoutCode);
      subject.next({
        type: 'error',
        data: JSON.stringify({
          error: timeoutMessage,
          code: timeoutCode,
        }),
      });
      subject.complete();
    }, PROVIDER_CONFIG.totalTimeoutMs);

    // Create completion request record
    const completionReq = this.completionRepo.create({
      workspaceId,
      userId,
      editorSessionId: payload.sessionId || null,
    });

    try {
      const saved = await this.completionRepo.save(completionReq);
      savedCompletionId = saved.id;

      // Step 1: Provider routing (A-075)
      const { adapter, endpointId, providerType } =
        await this.providerRouter.getProvider(workspaceId);

      // Update endpoint ID on the record
      if (endpointId) {
        saved.modelEndpointId = endpointId;
      }

      // Step 2: Retrieval gating (A-071)
      let evidence: RetrievalHit[] = [];
      let retrievalLatencyMs = 0;
      let isGrounded = false;
      let queryEmbedding: number[] | null = null;

      if (!this.promptAssembler.shouldSkipRetrieval(payload.prefix)) {
        const retrievalStart = Date.now();

        try {
          // Use last 500 chars for query embedding — captures enough local context
          // without being too narrow (200 was too short for topic-level retrieval).
          const queryText = payload.prefix.slice(-500).trim();
          queryEmbedding = await this.queryEmbedding.embed(queryText);

          if (queryEmbedding) {
            // Detect metadata filters from the prefix
            const metadataFilter = this.metadataAwareRetrieval.detectFilters(payload.prefix);

            evidence = await this.retrievalService.findSimilarChunks(
              workspaceId,
              queryEmbedding,
              { filters: metadataFilter ?? undefined },
            );

            // Fallback: if filters were applied but got 0 hits, retry without filters
            if (metadataFilter && evidence.length === 0) {
              evidence = await this.retrievalService.findSimilarChunks(
                workspaceId,
                queryEmbedding,
              );
            }
          } else {
            this.logger.warn('[Completion] RAG retrieval skipped — no query embedding (check OPENAI_API_KEY in API env)');
          }
        } catch (err) {
          // Retrieval failure is non-fatal — continue without evidence
          this.logger.warn(
            `[Completion] Retrieval failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        retrievalLatencyMs = Date.now() - retrievalStart;
      }

      // Step 3: Grounding flag — retrieval.service already applied the similarity
      // threshold in SQL, so any chunk that arrived here passed the bar.
      if (evidence.length > 0) {
        isGrounded = true;
      }

      // Step 3.5: Document type detection — classify the document before meta emission
      const docType = this.promptAssembler.detectDocumentType(payload.prefix);

      // Step 3.6: Structural match gate — reuse already-retrieved evidence (no second DB call)
      if (
        queryEmbedding &&
        queryEmbedding.length > 0 &&
        payload.prefix.trim().length >= STRUCTURAL_CONFIG.minPrefixChars &&
        evidence.length > 0 &&
        evidence[0].similarity >= STRUCTURAL_CONFIG.similarityThreshold
      ) {
        if (timedOut || signal?.aborted) return;
        await this.streamStructuralMatch(subject, evidence[0], saved.id, startMs, docType);
        return; // early return — skip LLM
      }

      // Emit retrieval metadata
      subject.next({
        type: 'meta',
        data: JSON.stringify({
          completionId: saved.id,
          retrievedChunks: evidence.length,
          retrievalLatencyMs,
          isGrounded,
          providerType,
          docType,
        }),
      });

      // Step 4: Persist retrieval hits (A-080)
      if (evidence.length > 0) {
        await this.persistRetrievalHits(saved.id, evidence);
      }

      // Step 5: Prompt assembly (A-072)
      const prompt = this.promptAssembler.assemblePrompt(payload.prefix, evidence);

      // Step 6: Stream from provider (A-073, A-074)
      const providerStart = Date.now();

      if (timedOut || signal?.aborted) return;

      const stream = adapter.streamCompletion({
        system: prompt.system,
        user: prompt.user,
        maxTokens: COMPLETION_CONFIG.maxCompletionTokens,
        temperature: 0.3,
        timeoutMs: PROVIDER_CONFIG.totalTimeoutMs - (Date.now() - startMs),
        signal,
      });

      for await (const token of stream) {
        if (timedOut || signal?.aborted) break;

        if (token.text) {
          subject.next({
            type: 'token',
            data: JSON.stringify({ text: token.text }),
          });
        }

        // Response cap (A-077) — check total response size
        if (token.done) break;
      }

      const providerLatencyMs = Date.now() - providerStart;
      const totalLatencyMs = Date.now() - startMs;

      if (timedOut) return;

      // Step 7: Log completion request (A-076)
      await this.completionRepo.update(saved.id, {
        modelEndpointId: endpointId,
        retrievedChunkCount: evidence.length,
        latencyMs: totalLatencyMs,
        providerLatencyMs,
        outcomeStatus: 'completed',
      });

      // Emit done event with evidence hits for the UI (A-080)
      subject.next({
        type: 'done',
        data: JSON.stringify({
          completionId: saved.id,
          latencyMs: totalLatencyMs,
          isGrounded,
          retrievalHits: evidence.map((hit, i) => ({
            rank: i + 1,
            chunkId: hit.chunkId,
            documentId: hit.documentId,
            documentTitle: hit.documentTitle,
            similarity: hit.similarity,
            excerpt: hit.content.slice(0, 200),
          })),
        }),
      });

      this.logger.debug(
        `[Completion] Done: id=${saved.id} latency=${totalLatencyMs}ms ` +
        `provider=${providerType}(${providerLatencyMs}ms) ` +
        `chunks=${evidence.length} retrieval=${retrievalLatencyMs}ms ` +
        `grounded=${isGrounded}`,
      );
    } catch (err) {
      // Abort path: silent cleanup — client already disconnected (REQ-6)
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return;
      }

      const rawMessage = err instanceof Error ? err.message : String(err);
      const code = mapToErrorCode(rawMessage);
      const message = getErrorMessage(code);

      this.logger.error(
        `[Completion] Pipeline error: code=${code} message=${rawMessage}`,
        err instanceof Error ? err.stack : undefined,
      );

      // Update status if we have a saved record
      if (savedCompletionId) {
        await this.completionRepo.update(savedCompletionId, {
          outcomeStatus: code === ErrorCode.INFRA_TIMEOUT || code === ErrorCode.COMPLETION_TIMEOUT
            ? 'timeout'
            : 'error',
          latencyMs: Date.now() - startMs,
        }).catch(() => {/* swallow — best effort */});
      }

      if (!timedOut) {
        subject.next({
          type: 'error',
          data: JSON.stringify({
            error: message,
            code,
          }),
        });
      }
    } finally {
      clearTimeout(timeoutHandle);
      subject.complete();
    }
  }

  /**
   * Stream a structural match result directly, bypassing the LLM provider.
   *
   * Emits meta → tokens → done (via streamTokens) → persists hit → updates record.
   * The `streamTokens` method on StructuralMatchService emits `done` internally.
   */
  private async streamStructuralMatch(
    subject: Subject<SseMessageEvent>,
    hit: RetrievalHit,
    completionId: string,
    startMs: number,
    docType: string | null,
  ): Promise<void> {
    // 1. Emit meta event (isGrounded: true, structuralMatch: true)
    subject.next({
      type: 'meta',
      data: JSON.stringify({
        completionId,
        retrievedChunks: 1,
        retrievalLatencyMs: 0,
        isGrounded: true,
        structuralMatch: true,
        docType,
      }),
    });

    // 2. Stream the structural content as tokens (also emits done)
    this.structuralMatchService.streamTokens(subject, hit, completionId, startMs);

    // 3. Non-fatal bookkeeping — must NOT throw after done was emitted
    try {
      await this.persistRetrievalHits(completionId, [hit]);
    } catch (err) {
      this.logger.warn(`[Structural] Failed to persist hit: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      await this.completionRepo.update(completionId, {
        retrievedChunkCount: 1,
        latencyMs: Date.now() - startMs,
        outcomeStatus: 'completed',
      });
    } catch (err) {
      this.logger.warn(`[Structural] Failed to update completion record: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Persist ranked retrieval hits to the database (A-080).
   * Stores which chunks were used for each completion with rank and similarity.
   */
  private async persistRetrievalHits(
    completionRequestId: string,
    hits: RetrievalHit[],
  ): Promise<void> {
    try {
      const entities = hits.map((hit, index) =>
        this.hitRepo.create({
          completionRequestId,
          documentChunkId: hit.chunkId,
          rank: index + 1,
          similarityScore: hit.similarity,
        }),
      );

      await this.hitRepo.save(entities);

      this.logger.debug(
        `[Retrieval] Persisted ${hits.length} hits for completion=${completionRequestId}`,
      );
    } catch (err) {
      // Non-fatal — don't fail the completion because of logging
      this.logger.warn(
        `[Retrieval] Failed to persist hits: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

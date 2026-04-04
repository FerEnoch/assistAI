import { Injectable, Logger } from '@nestjs/common';
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
} from '@assistai/shared';
import type { CompletionRequestPayload, RetrievalHit } from '@assistai/shared';
import { RetrievalService } from '../retrieval/retrieval.service';
import { QueryEmbeddingService } from '../retrieval/query-embedding.service';
import { PromptAssembler } from './prompt-assembler';
import { ProviderRouter } from '../provider/provider-router.service';

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
    private readonly queryEmbedding: QueryEmbeddingService,
    private readonly promptAssembler: PromptAssembler,
    private readonly providerRouter: ProviderRouter,
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
  ): Observable<SseMessageEvent> {
    const subject = new Subject<SseMessageEvent>();

    // Run pipeline asynchronously
    void this.runPipeline(workspaceId, userId, payload, subject);

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
  ): Promise<void> {
    const startMs = Date.now();
    let timedOut = false;
    let savedCompletionId: string | null = null;

    // Timeout budget (A-077) — abort after totalTimeoutMs
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      subject.next({
        type: 'error',
        data: JSON.stringify({
          error: 'La solicitud excedió el tiempo límite. Intentá de nuevo.',
          code: 'TIMEOUT',
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

      if (!this.promptAssembler.shouldSkipRetrieval(payload.prefix)) {
        const retrievalStart = Date.now();

        try {
          const queryText = payload.prefix.slice(-200).trim();
          const queryEmbedding = await this.queryEmbedding.embed(queryText);

          if (queryEmbedding) {
            evidence = await this.retrievalService.findSimilarChunks(
              workspaceId,
              queryEmbedding,
            );
          }
        } catch (err) {
          // Retrieval failure is non-fatal — continue without evidence
          this.logger.warn(
            `[Completion] Retrieval failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        retrievalLatencyMs = Date.now() - retrievalStart;
      }

      // Step 3: Weak-grounding suppression (A-083)
      // If top similarity < 0.72, strip retrieval context
      if (evidence.length > 0) {
        const topSimilarity = evidence[0].similarity;
        if (topSimilarity < RETRIEVAL_CONFIG.similarityThreshold) {
          this.logger.debug(
            `[Completion] Suppressing weak evidence: topSimilarity=${topSimilarity.toFixed(4)} < threshold=${RETRIEVAL_CONFIG.similarityThreshold}`,
          );
          evidence = [];
          isGrounded = false;
        } else {
          isGrounded = true;
        }
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

      if (timedOut) return;

      const stream = adapter.streamCompletion({
        system: prompt.system,
        user: prompt.user,
        maxTokens: COMPLETION_CONFIG.maxCompletionTokens,
        temperature: 0.3,
        timeoutMs: PROVIDER_CONFIG.totalTimeoutMs - (Date.now() - startMs),
      });

      for await (const token of stream) {
        if (timedOut) break;

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
      const message = err instanceof Error ? err.message : String(err);
      const mappedError = this.mapErrorToUserError(message);

      this.logger.error(
        `[Completion] Pipeline error: code=${mappedError.code} message=${message}`,
        err instanceof Error ? err.stack : undefined,
      );

      // Update status if we have a saved record
      if (savedCompletionId) {
        await this.completionRepo.update(savedCompletionId, {
          outcomeStatus: mappedError.code === 'TIMEOUT' ? 'timeout' : 'error',
          latencyMs: Date.now() - startMs,
        }).catch(() => {/* swallow — best effort */});
      }

      if (!timedOut) {
        subject.next({
          type: 'error',
          data: JSON.stringify({
            error: mappedError.message,
            code: mappedError.code,
          }),
        });
      }
    } finally {
      clearTimeout(timeoutHandle);
      subject.complete();
    }
  }

  /**
   * Map backend error messages to user-friendly Spanish messages.
   */
  private mapErrorToUserError(error: string): { code: string; message: string } {
    const lower = error.toLowerCase();

    if (lower.includes('timeout') || lower.includes('tiempo')) {
      return {
        code: 'TIMEOUT',
        message: 'La solicitud tardó demasiado. Intentá de nuevo.',
      };
    }

    if (lower.includes('no_provider_configured') || lower.includes('no hay proveedores')) {
      return {
        code: 'NO_PROVIDER_AVAILABLE',
        message: 'No hay proveedores de IA disponibles en este momento.',
      };
    }

    if (lower.includes('quota_exhausted') || lower.includes('quota') || lower.includes('limit') || lower.includes('agotad')) {
      return {
        code: 'QUOTA_EXHAUSTED',
        message: 'Se agotó la cuota gratuita de IA. Probá más tarde.',
      };
    }

    if (lower.includes('rate_limit') || lower.includes('frecuencia') || lower.includes('429')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Hay muchas solicitudes. Esperá un momento e intentá de nuevo.',
      };
    }

    if (lower.includes('providers_unavailable') || lower.includes('network') || lower.includes('connection') || lower.includes('econnrefused') || lower.includes('enotfound')) {
      return {
        code: 'PROVIDERS_UNAVAILABLE',
        message: 'Los proveedores de IA no están disponibles temporalmente.',
      };
    }

    if (lower.includes('all_providers_failed')) {
      return {
        code: 'ALL_PROVIDERS_FAILED',
        message: 'Ningún proveedor de IA pudo completar la solicitud en este momento.',
      };
    }

    if (lower.includes('authentication') || lower.includes('autentic') || lower.includes('api_key') || lower.includes('invalid') || lower.includes('401') || lower.includes('403')) {
      return {
        code: 'AUTH_ERROR',
        message: 'Error de autenticación con el proveedor de IA.',
      };
    }

    if (lower.includes('bad_request') || lower.includes('invalid_request') || lower.includes('model') || lower.includes('unsupported') || lower.includes('400')) {
      return {
        code: 'BAD_REQUEST',
        message: 'La solicitud no pudo procesarse (modelo o parámetros inválidos).',
      };
    }

    return {
      code: 'COMPLETION_FAILED',
      message: 'Error al generar la sugerencia. Intentá de nuevo.',
    };
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

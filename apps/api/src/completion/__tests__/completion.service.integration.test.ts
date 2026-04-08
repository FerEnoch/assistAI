import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RetrievalHit } from '@assistai/shared';
import { STRUCTURAL_CONFIG } from '@assistai/shared';
import type { SseMessageEvent } from '../completion.service';

/**
 * CompletionService integration tests — structural gate.
 *
 * Tests the integration between CompletionService and StructuralMatchService:
 * - Structural path fires → LLM NOT called
 * - findMatch returns null → LLM IS called
 * - Prefix too short → structural gate skipped
 * - done event shape on structural path
 */
describe('CompletionService — structural gate integration', () => {
  // Shared test fixtures
  const LONG_PREFIX = 'A'.repeat(150); // > minPrefixChars (100)
  const SHORT_PREFIX = 'B'.repeat(50); // < minPrefixChars (100)
  const WORKSPACE_ID = 'ws-test';
  const USER_ID = 'u-test';

  const STRUCTURAL_HIT: RetrievalHit = {
    chunkId: 'chunk-struct-1',
    documentId: 'doc-struct-1',
    content: 'CONTRATO DE LOCACIÓN entre las partes acuerdan lo siguiente...',
    similarity: 0.92,
    documentTitle: 'Contrato Locación 2024',
  };

  // Mocks shared across tests
  let mockSessionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockCompletionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockHitRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockDataSource: Record<string, unknown>;
  let mockRetrievalService: Record<string, ReturnType<typeof vi.fn>>;
  let mockQueryEmbedding: Record<string, ReturnType<typeof vi.fn>>;
  let mockPromptAssembler: Record<string, ReturnType<typeof vi.fn>>;
  let mockAdapter: Record<string, ReturnType<typeof vi.fn>>;
  let mockProviderRouter: Record<string, ReturnType<typeof vi.fn>>;
  let mockStructuralMatch: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSessionRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
    mockCompletionRepo = {
      create: vi.fn().mockReturnValue({ id: 'test-completion-id' }),
      save: vi.fn().mockResolvedValue({ id: 'test-completion-id' }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    mockHitRepo = {
      create: vi.fn().mockImplementation((data) => data),
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockDataSource = {};

    mockRetrievalService = {
      findSimilarChunks: vi.fn().mockResolvedValue([]),
    };

    // The query embedding mock — returns a valid embedding vector
    mockQueryEmbedding = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };

    mockPromptAssembler = {
      shouldSkipRetrieval: vi.fn().mockReturnValue(false), // retrieval NOT skipped
      assemblePrompt: vi.fn().mockReturnValue({ system: 'sys', user: 'usr' }),
      detectDocumentType: vi.fn().mockReturnValue(null),
    };

    // LLM adapter mock — yields tokens when called
    mockAdapter = {
      streamCompletion: vi.fn().mockReturnValue(
        (async function* () {
          yield { text: 'hello', done: false };
          yield { text: '', done: true };
        })(),
      ),
    };

    mockProviderRouter = {
      getProvider: vi.fn().mockResolvedValue({
        adapter: mockAdapter,
        endpointId: 'ep-1',
        providerType: 'openrouter',
      }),
    };

    // StructuralMatchService mock — default: no match
    mockStructuralMatch = {
      findMatch: vi.fn().mockResolvedValue(null),
      streamTokens: vi.fn(),
    };
  });

  /**
   * Helper: create CompletionService with all mocks injected.
   */
  async function createService() {
    const { CompletionService } = await import('../completion.service');
    return new CompletionService(
      mockSessionRepo as any,
      mockCompletionRepo as any,
      mockHitRepo as any,
      mockDataSource as any,
      mockRetrievalService as any,
      mockQueryEmbedding as any,
      mockPromptAssembler as any,
      mockProviderRouter as any,
      mockStructuralMatch as any,
    );
  }

  /**
   * Helper: collect all SSE events from streamCompletion.
   */
  function collectEvents(
    service: any,
    prefix: string,
  ): Promise<SseMessageEvent[]> {
    const observable = service.streamCompletion(WORKSPACE_ID, USER_ID, {
      prefix,
      sessionId: 'sess-1',
      cursorPosition: prefix.length,
    });

    const events: SseMessageEvent[] = [];
    return new Promise<SseMessageEvent[]>((resolve) => {
      observable.subscribe({
        next: (e: SseMessageEvent) => events.push(e),
        complete: () => resolve(events),
        error: () => resolve(events),
      });
    });
  }

  // ─── Task 3.1: structural path → provider stream NOT called ───────────────

  it('does NOT call adapter.streamCompletion when structural match fires', async () => {
    // Return a hit with similarity >= STRUCTURAL_CONFIG.similarityThreshold from retrieval
    mockRetrievalService.findSimilarChunks.mockResolvedValue([STRUCTURAL_HIT]);
    mockStructuralMatch.streamTokens.mockImplementation(
      (subject: any, hit: RetrievalHit, completionId: string, startMs: number) => {
        subject.next({
          type: 'token',
          data: JSON.stringify({ text: hit.content }),
        });
        subject.next({
          type: 'done',
          data: JSON.stringify({
            completionId,
            latencyMs: Date.now() - startMs,
            isGrounded: true,
            structuralMatch: true,
            retrievalHits: [{
              rank: 1,
              chunkId: hit.chunkId,
              documentId: hit.documentId,
              documentTitle: hit.documentTitle,
              similarity: hit.similarity,
              excerpt: hit.content.slice(0, 200),
            }],
          }),
        });
      },
    );

    const service = await createService();
    const events = await collectEvents(service, LONG_PREFIX);

    // LLM adapter must NOT be called
    expect(mockAdapter.streamCompletion).toHaveBeenCalledTimes(0);

    // At least one token event must be emitted
    const tokenEvents = events.filter((e) => e.type === 'token');
    expect(tokenEvents.length).toBeGreaterThanOrEqual(1);

    // done event must include structuralMatch: true
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);
    const donePayload = JSON.parse(doneEvents[0].data);
    expect(donePayload.structuralMatch).toBe(true);
  });

  // ─── Task 3.2: findMatch returns null → LLM IS called ────────────────────

  it('calls adapter.streamCompletion when no structural match (LLM fallback)', async () => {
    // Default: findSimilarChunks returns [] — no evidence, structural gate not met

    const service = await createService();
    const events = await collectEvents(service, LONG_PREFIX);

    // LLM adapter MUST be called
    expect(mockAdapter.streamCompletion).toHaveBeenCalledTimes(1);

    // done event must NOT include structuralMatch: true
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);
    const donePayload = JSON.parse(doneEvents[0].data);
    expect(donePayload.structuralMatch).toBeUndefined();
  });

  // ─── Task 3.3: prefix too short → structural gate skipped ─────────────────

  it('does NOT enter structural path when prefix is below minPrefixChars', async () => {
    // Even if retrieval returns a high-similarity hit, structural gate checks prefix length
    mockRetrievalService.findSimilarChunks.mockResolvedValue([STRUCTURAL_HIT]);

    const service = await createService();
    const events = await collectEvents(service, SHORT_PREFIX);

    // Structural streamTokens must NOT be called — prefix too short
    expect(mockStructuralMatch.streamTokens).not.toHaveBeenCalled();

    // LLM adapter SHOULD be called (normal path)
    expect(mockAdapter.streamCompletion).toHaveBeenCalledTimes(1);
  });

  // ─── Task 3.4: done event shape with structuralMatch: true ────────────────

  it('done event includes full structural match metadata shape', async () => {
    mockRetrievalService.findSimilarChunks.mockResolvedValue([STRUCTURAL_HIT]);
    mockStructuralMatch.streamTokens.mockImplementation(
      (subject: any, hit: RetrievalHit, completionId: string, startMs: number) => {
        subject.next({
          type: 'token',
          data: JSON.stringify({ text: hit.content }),
        });
        subject.next({
          type: 'done',
          data: JSON.stringify({
            completionId,
            latencyMs: Date.now() - startMs,
            isGrounded: true,
            structuralMatch: true,
            retrievalHits: [{
              rank: 1,
              chunkId: hit.chunkId,
              documentId: hit.documentId,
              documentTitle: hit.documentTitle,
              similarity: hit.similarity,
              excerpt: hit.content.slice(0, 200),
            }],
          }),
        });
      },
    );

    const service = await createService();
    const events = await collectEvents(service, LONG_PREFIX);

    // Verify meta event has structural flag
    const metaEvents = events.filter((e) => e.type === 'meta');
    expect(metaEvents).toHaveLength(1);
    const metaPayload = JSON.parse(metaEvents[0].data);
    expect(metaPayload.completionId).toBe('test-completion-id');
    expect(metaPayload.isGrounded).toBe(true);
    expect(metaPayload.structuralMatch).toBe(true);

    // Verify done event shape
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);
    const donePayload = JSON.parse(doneEvents[0].data);
    expect(donePayload).toEqual(
      expect.objectContaining({
        completionId: 'test-completion-id',
        isGrounded: true,
        structuralMatch: true,
        retrievalHits: expect.arrayContaining([
          expect.objectContaining({
            rank: 1,
            chunkId: 'chunk-struct-1',
            documentId: 'doc-struct-1',
            documentTitle: 'Contrato Locación 2024',
            similarity: 0.92,
          }),
        ]),
      }),
    );
    expect(donePayload.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // ─── Task 3.3 triangulation: boundary at exactly minPrefixChars ───────────

  it('enters structural path when prefix is exactly at minPrefixChars boundary (100 chars)', async () => {
    const exactBoundaryPrefix = 'C'.repeat(100); // exactly 100 — should pass the gate
    mockRetrievalService.findSimilarChunks.mockResolvedValue([STRUCTURAL_HIT]);
    mockStructuralMatch.streamTokens.mockImplementation(
      (subject: any, hit: RetrievalHit, completionId: string, startMs: number) => {
        subject.next({ type: 'token', data: JSON.stringify({ text: hit.content }) });
        subject.next({ type: 'done', data: JSON.stringify({ completionId, latencyMs: Date.now() - startMs, isGrounded: true, structuralMatch: true, retrievalHits: [] }) });
      },
    );

    const service = await createService();
    await collectEvents(service, exactBoundaryPrefix);

    // streamTokens SHOULD be called — prefix meets the threshold and evidence[0].similarity >= 0.85
    expect(mockStructuralMatch.streamTokens).toHaveBeenCalledTimes(1);
    // LLM adapter must NOT be called — structural path took over
    expect(mockAdapter.streamCompletion).not.toHaveBeenCalled();
  });

  // ─── Task 3.9: verify LLM pipeline steps 4-7 are skipped on structural ───

  it('skips prompt assembly and LLM adapter when structural fires, but still persists the hit', async () => {
    mockRetrievalService.findSimilarChunks.mockResolvedValue([STRUCTURAL_HIT]);
    mockStructuralMatch.streamTokens.mockImplementation(
      (subject: any, hit: RetrievalHit, completionId: string, startMs: number) => {
        subject.next({
          type: 'token',
          data: JSON.stringify({ text: hit.content }),
        });
        subject.next({
          type: 'done',
          data: JSON.stringify({
            completionId,
            latencyMs: Date.now() - startMs,
            isGrounded: true,
            structuralMatch: true,
          }),
        });
      },
    );

    const service = await createService();
    await collectEvents(service, LONG_PREFIX);

    // promptAssembler.assemblePrompt must NOT be called (Step 5 skipped)
    expect(mockPromptAssembler.assemblePrompt).not.toHaveBeenCalled();

    // adapter.streamCompletion must NOT be called (Step 6 skipped)
    expect(mockAdapter.streamCompletion).not.toHaveBeenCalled();

    // Hit SHOULD still be persisted via persistRetrievalHits
    expect(mockHitRepo.save).toHaveBeenCalledTimes(1);
  });
});

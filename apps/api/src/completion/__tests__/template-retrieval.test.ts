import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RetrievalHit } from '@assistai/shared';
import type { SseMessageEvent } from '../completion.service';

/**
 * CompletionService — template-aware retrieval tests.
 *
 * Validates that templateId in the payload:
 * - Loads template sections and prepends them as high-priority evidence
 * - Silently ignores templates from other workspaces (SQL filters by workspace_id)
 * - Does not regress when templateId is omitted
 */
describe('CompletionService — template-aware retrieval', () => {
  const LONG_PREFIX = 'A'.repeat(150);
  const WORKSPACE_ID = 'ws-test';
  const USER_ID = 'u-test';
  const TEMPLATE_ID = 'tpl-1';

  const NORMAL_HIT: RetrievalHit = {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    content: 'Normal retrieval content',
    similarity: 0.78,
    documentTitle: 'Doc Normal',
  };

  let mockSessionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockCompletionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockHitRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockDataSource: Record<string, ReturnType<typeof vi.fn>>;
  let mockRetrievalService: Record<string, ReturnType<typeof vi.fn>>;
  let mockQueryEmbedding: Record<string, ReturnType<typeof vi.fn>>;
  let mockPromptAssembler: Record<string, ReturnType<typeof vi.fn>>;
  let mockAdapter: Record<string, ReturnType<typeof vi.fn>>;
  let mockProviderRouter: Record<string, ReturnType<typeof vi.fn>>;
  let mockStructuralMatch: Record<string, ReturnType<typeof vi.fn>>;
  let mockMetadataAwareRetrieval: Record<string, ReturnType<typeof vi.fn>>;

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
    mockDataSource = {
      query: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    };

    mockRetrievalService = {
      findSimilarChunks: vi.fn().mockResolvedValue([NORMAL_HIT]),
    };

    mockQueryEmbedding = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };

    mockPromptAssembler = {
      shouldSkipRetrieval: vi.fn().mockReturnValue(false),
      assemblePrompt: vi.fn().mockReturnValue({ system: 'sys', user: 'usr' }),
      detectDocumentType: vi.fn().mockReturnValue(null),
    };

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

    mockStructuralMatch = {
      findMatch: vi.fn().mockResolvedValue(null),
      streamTokens: vi.fn(),
    };

    mockMetadataAwareRetrieval = {
      detectFilters: vi.fn().mockReturnValue(null),
    };
  });

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
      mockMetadataAwareRetrieval as any,
    );
  }

  function collectEvents(
    service: any,
    prefix: string,
    templateId?: string,
  ): Promise<SseMessageEvent[]> {
    const observable = service.streamCompletion(WORKSPACE_ID, USER_ID, {
      prefix,
      sessionId: 'sess-1',
      cursorPosition: prefix.length,
      templateId,
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

  // ─── Template sections appear first in evidence ────────────────────────────

  it('prepends template sections as high-priority evidence when templateId is valid', async () => {
    mockDataSource.query.mockResolvedValue([
      {
        id: 'sec-1',
        templateId: TEMPLATE_ID,
        name: 'Encabezado',
        content: 'Template section content',
        workspaceId: WORKSPACE_ID,
      },
    ]);

    const service = await createService();
    await collectEvents(service, LONG_PREFIX, TEMPLATE_ID);

    // dataSource.query should be called for template sections
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('template_sections'),
      [TEMPLATE_ID, WORKSPACE_ID],
    );

    // assemblePrompt should be called with template hits FIRST
    expect(mockPromptAssembler.assemblePrompt).toHaveBeenCalledTimes(1);
    const evidenceArg = mockPromptAssembler.assemblePrompt.mock.calls[0][1] as RetrievalHit[];

    expect(evidenceArg.length).toBe(2);
    // Template hit first
    expect(evidenceArg[0].similarity).toBe(1.0);
    expect(evidenceArg[0].content).toBe('Template section content');
    expect(evidenceArg[0].metadata).toEqual(
      expect.objectContaining({ isTemplate: true, sourceTemplateId: TEMPLATE_ID }),
    );
    // Normal hit second
    expect(evidenceArg[1].chunkId).toBe('chunk-1');
  });

  // ─── Template from another workspace is silently ignored (SQL WHERE filters) ──

  it('returns no template hits when template belongs to a different workspace (SQL filters)', async () => {
    // SQL WHERE clause includes workspace_id, so mismatched workspace returns empty
    mockDataSource.query.mockResolvedValue([]);

    const service = await createService();
    await collectEvents(service, LONG_PREFIX, TEMPLATE_ID);

    const evidenceArg = mockPromptAssembler.assemblePrompt.mock.calls[0][1] as RetrievalHit[];

    // Only normal hit — no template sections returned by query
    expect(evidenceArg.length).toBe(1);
    expect(evidenceArg[0].chunkId).toBe('chunk-1');
  });

  // ─── No templateId → identical behavior (no regression) ────────────────────

  it('does not query template sections when templateId is omitted', async () => {
    const service = await createService();
    await collectEvents(service, LONG_PREFIX);

    // dataSource.query should NOT be called for template sections
    expect(mockDataSource.query).not.toHaveBeenCalled();

    const evidenceArg = mockPromptAssembler.assemblePrompt.mock.calls[0][1] as RetrievalHit[];
    expect(evidenceArg.length).toBe(1);
    expect(evidenceArg[0].chunkId).toBe('chunk-1');
  });
});

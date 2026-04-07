import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbedProcessor } from '../embed.processor';

// ── Mocks ──────────────────────────────────────────────────────────────

const mockManager = { query: vi.fn() };
const mockDataSource = {
  getRepository: vi.fn(),
  transaction: vi.fn(),
  query: vi.fn(),
};
const mockEmbeddingProvider = {
  embedBatch: vi.fn(),
  modelVersion: 'text-embedding-3-small-1024d',
};

function buildProcessor(): EmbedProcessor {
  return new EmbedProcessor(
    mockDataSource as never,
    mockEmbeddingProvider as never,
  );
}

function fakeJob(documentId = 'doc-1', workspaceId = 'ws-1') {
  return { data: { documentId, workspaceId } } as never;
}

// ── Helpers ────────────────────────────────────────────────────────────

const fakeChunks = [
  { id: 'chunk-aaa', documentId: 'doc-1', workspaceId: 'ws-1', chunkIndex: 0, content: 'Hello' },
  { id: 'chunk-bbb', documentId: 'doc-1', workspaceId: 'ws-1', chunkIndex: 1, content: 'World' },
];

const fakeEmbeddings = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
];

// ── Tests ──────────────────────────────────────────────────────────────

describe('EmbedProcessor', () => {
  let processor: EmbedProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = buildProcessor();
  });

  // Scenario 1: Happy path — bulk UPDATE in a single query
  describe('happy path (N chunks)', () => {
    beforeEach(() => {
      mockDataSource.getRepository.mockReturnValue({
        find: vi.fn().mockResolvedValue(fakeChunks),
      });
      mockEmbeddingProvider.embedBatch.mockResolvedValue(fakeEmbeddings);
      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => Promise<void>) => cb(mockManager));
    });

    it('enters transaction exactly once', async () => {
      await processor.process(fakeJob());
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('calls manager.query exactly twice (bulk UPDATE + doc status)', async () => {
      await processor.process(fakeJob());
      expect(mockManager.query).toHaveBeenCalledTimes(2);
    });

    it('returns { embedded: N }', async () => {
      const result = await processor.process(fakeJob());
      expect(result).toEqual({ embedded: 2 });
    });
  });

  // Scenario 2: Zero chunks — early return, no DB calls
  describe('zero chunks', () => {
    beforeEach(() => {
      mockDataSource.getRepository.mockReturnValue({
        find: vi.fn().mockResolvedValue([]),
      });
    });

    it('returns { embedded: 0 }', async () => {
      const result = await processor.process(fakeJob());
      expect(result).toEqual({ embedded: 0 });
    });

    it('does not call transaction', async () => {
      await processor.process(fakeJob());
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('does not call embedBatch', async () => {
      await processor.process(fakeJob());
      expect(mockEmbeddingProvider.embedBatch).not.toHaveBeenCalled();
    });
  });

  // Scenario 3: Embedding count mismatch — fails before transaction and marks doc failed
  describe('embedding count mismatch', () => {
    beforeEach(() => {
      mockDataSource.getRepository.mockReturnValue({
        find: vi.fn().mockResolvedValue(fakeChunks),
      });
      // Return 1 embedding for 2 chunks
      mockEmbeddingProvider.embedBatch.mockResolvedValue([[0.1, 0.2]]);
    });

    it('throws with descriptive "mismatch" message', async () => {
      await expect(processor.process(fakeJob())).rejects.toThrow(/mismatch/i);
    });

    it('does not enter transaction', async () => {
      await processor.process(fakeJob()).catch(() => {});
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('marks document as failed with EMBEDDING_ERROR', async () => {
      await processor.process(fakeJob()).catch(() => {});
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("ingest_status = 'failed'"),
        ['EMBEDDING_ERROR: Embedding count mismatch: got 1, expected 2', 'doc-1'],
      );
    });
  });

  // Scenario 4: DB error in transaction — document marked failed, error re-thrown
  describe('DB error in transaction', () => {
    const dbError = new Error('pg: connection refused');

    beforeEach(() => {
      mockDataSource.getRepository.mockReturnValue({
        find: vi.fn().mockResolvedValue(fakeChunks),
      });
      mockEmbeddingProvider.embedBatch.mockResolvedValue(fakeEmbeddings);
      mockDataSource.transaction.mockRejectedValue(dbError);
    });

    it('re-throws the error for BullMQ retry', async () => {
      await expect(processor.process(fakeJob())).rejects.toThrow('pg: connection refused');
    });

    it('marks document as failed with error_reason', async () => {
      await processor.process(fakeJob()).catch(() => {});
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ingest_status'),
        expect.arrayContaining([expect.stringContaining('pg: connection refused')]),
      );
    });
  });

  // Scenario 5: Query parameter shape validation
  describe('query parameter shape', () => {
    beforeEach(() => {
      mockDataSource.getRepository.mockReturnValue({
        find: vi.fn().mockResolvedValue(fakeChunks),
      });
      mockEmbeddingProvider.embedBatch.mockResolvedValue(fakeEmbeddings);
      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => Promise<void>) => cb(mockManager));
    });

    it('$1 is array of UUID strings (chunk IDs)', async () => {
      await processor.process(fakeJob());
      const [, params] = mockManager.query.mock.calls[0];
      expect(params[0]).toEqual(['chunk-aaa', 'chunk-bbb']);
    });

    it('$2 is array of vector literal strings', async () => {
      await processor.process(fakeJob());
      const [, params] = mockManager.query.mock.calls[0];
      expect(params[1]).toEqual(['[0.1,0.2,0.3]', '[0.4,0.5,0.6]']);
    });

    it('$3 is scalar model_version string', async () => {
      await processor.process(fakeJob());
      const [, params] = mockManager.query.mock.calls[0];
      expect(params[2]).toBe('text-embedding-3-small-1024d');
    });

    it('bulk UPDATE SQL contains unnest', async () => {
      await processor.process(fakeJob());
      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('unnest');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetrievalService } from '../retrieval.service';
import { RETRIEVAL_CONFIG, EMBEDDING_CONFIG } from '@assistai/shared';

/**
 * Retrieval service tests — tenant isolation, threshold filtering, debug logging (A-053, A-055, A-056).
 *
 * findSimilarChunks now runs inside dataSource.transaction(), so we mock
 * `transaction` as a callback invoker that passes a `mockManager` to the cb.
 * findDocumentsNeedingReindex still uses dataSource.query directly.
 */

function fakeEmbedding(dim = EMBEDDING_CONFIG.dimensions): number[] {
  return Array.from({ length: dim }, () => Math.random());
}

describe('RetrievalService', () => {
  let service: RetrievalService;
  let mockManager: { query: ReturnType<typeof vi.fn> };
  let mockDs: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockManager = { query: vi.fn(async () => []) };
    mockDs = {
      query: vi.fn(async () => []),
      transaction: vi.fn(async (cb: (manager: typeof mockManager) => Promise<unknown>) => cb(mockManager)),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new RetrievalService(mockDs as any);
  });

  describe('findSimilarChunks', () => {
    it('wraps SET LOCAL and SELECT in a single transaction', async () => {
      const embedding = fakeEmbedding();

      await service.findSimilarChunks('ws-1', embedding);

      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.query).toHaveBeenCalledTimes(2);
    });

    it('enforces workspace_id tenant isolation in the query', async () => {
      const wsId = 'workspace-123';
      const embedding = fakeEmbedding();

      await service.findSimilarChunks(wsId, embedding);

      // Second manager.query call is the search query (first is SET LOCAL)
      const searchCall = mockManager.query.mock.calls[1];
      expect(searchCall).toBeDefined();

      const sql = searchCall[0] as string;
      const params = searchCall[1] as unknown[];

      // Verify workspace_id is passed as parameter
      expect(sql).toContain('dc.workspace_id = $2');
      expect(params[1]).toBe(wsId);
    });

    it('sets hnsw.ef_search before querying', async () => {
      const embedding = fakeEmbedding();

      await service.findSimilarChunks('ws-1', embedding);

      const firstCall = mockManager.query.mock.calls[0];
      expect(firstCall[0]).toContain(`SET LOCAL hnsw.ef_search = ${RETRIEVAL_CONFIG.hnswEfSearch}`);
    });

    it('applies cosine similarity threshold', async () => {
      const embedding = fakeEmbedding();

      await service.findSimilarChunks('ws-1', embedding, {
        similarityThreshold: 0.8,
      });

      const searchCall = mockManager.query.mock.calls[1];
      const params = searchCall[1] as unknown[];

      // $3 is the threshold parameter
      expect(params[2]).toBe(0.8);
    });

    it('uses default threshold from RETRIEVAL_CONFIG when not specified', async () => {
      const embedding = fakeEmbedding();

      await service.findSimilarChunks('ws-1', embedding);

      const searchCall = mockManager.query.mock.calls[1];
      const params = searchCall[1] as unknown[];

      expect(params[2]).toBe(RETRIEVAL_CONFIG.similarityThreshold);
    });

    it('limits results to topK', async () => {
      const embedding = fakeEmbedding();

      await service.findSimilarChunks('ws-1', embedding, { topK: 2 });

      const searchCall = mockManager.query.mock.calls[1];
      const params = searchCall[1] as unknown[];

      // $4 is the LIMIT parameter
      expect(params[3]).toBe(2);
    });

    it('uses default topK from RETRIEVAL_CONFIG when not specified', async () => {
      const embedding = fakeEmbedding();

      await service.findSimilarChunks('ws-1', embedding);

      const searchCall = mockManager.query.mock.calls[1];
      const params = searchCall[1] as unknown[];

      expect(params[3]).toBe(RETRIEVAL_CONFIG.topK);
    });

    it('rejects embeddings with wrong dimensions', async () => {
      const wrongDim = Array.from({ length: 512 }, () => 0.1);

      await expect(
        service.findSimilarChunks('ws-1', wrongDim),
      ).rejects.toThrow('Embedding dimension mismatch');
    });

    it('maps raw rows to RetrievalHit interface', async () => {
      const mockRows = [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          content: 'Artículo 123 del Código Civil',
          similarity: 0.89,
          documentTitle: 'Código Civil Argentino',
        },
        {
          chunkId: 'chunk-2',
          documentId: 'doc-1',
          content: 'Artículo 124',
          similarity: 0.75,
          documentTitle: 'Código Civil Argentino',
        },
      ];

      mockManager.query.mockImplementation(async (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('SET LOCAL')) return [];
        return mockRows;
      });

      const results = await service.findSimilarChunks('ws-1', fakeEmbedding());

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        content: 'Artículo 123 del Código Civil',
        similarity: 0.89,
        documentTitle: 'Código Civil Argentino',
      });
    });

    it('does NOT return chunks from other workspaces (tenant isolation)', async () => {
      // This verifies the SQL WHERE clause scopes to workspace_id
      const embedding = fakeEmbedding();

      await service.findSimilarChunks('workspace-A', embedding);

      // Verify workspace-A call passed correct workspace ID
      const callA = mockManager.query.mock.calls[1]; // search query for A
      expect((callA[1] as unknown[])[1]).toBe('workspace-A');

      // Reset for second call
      mockManager.query.mockClear();

      await service.findSimilarChunks('workspace-B', embedding);

      const callB = mockManager.query.mock.calls[1]; // search query for B
      expect((callB[1] as unknown[])[1]).toBe('workspace-B');
    });

    it('returns empty array when no chunks match', async () => {
      const results = await service.findSimilarChunks('ws-empty', fakeEmbedding());
      expect(results).toEqual([]);
    });

    it('propagates an error thrown during SET LOCAL', async () => {
      const dbError = new Error('DB connection lost');
      mockManager.query.mockRejectedValueOnce(dbError);

      await expect(
        service.findSimilarChunks('ws-1', fakeEmbedding(), {}),
      ).rejects.toThrow('DB connection lost');

      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('propagates an error thrown during the vector SELECT', async () => {
      // First query (SET LOCAL) succeeds, second (SELECT) fails
      mockManager.query
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('vector search failed'));

      await expect(
        service.findSimilarChunks('ws-1', fakeEmbedding(), {}),
      ).rejects.toThrow('vector search failed');
    });
  });

  describe('findDocumentsNeedingReindex', () => {
    it('queries only within the given workspace', async () => {
      await service.findDocumentsNeedingReindex('ws-reindex');

      const call = mockDs.query.mock.calls[0];
      const sql = call[0] as string;
      const params = call[1] as unknown[];

      expect(sql).toContain('d.workspace_id = $1');
      expect(params[0]).toBe('ws-reindex');
    });

    it('finds documents where checksum differs from chunk content_hash', async () => {
      mockDs.query.mockResolvedValueOnce([
        { id: 'doc-stale-1' },
        { id: 'doc-stale-2' },
      ]);

      const result = await service.findDocumentsNeedingReindex('ws-1');

      expect(result).toEqual(['doc-stale-1', 'doc-stale-2']);
    });

    it('returns empty array when all documents are current', async () => {
      mockDs.query.mockResolvedValueOnce([]);

      const result = await service.findDocumentsNeedingReindex('ws-1');
      expect(result).toEqual([]);
    });
  });
});

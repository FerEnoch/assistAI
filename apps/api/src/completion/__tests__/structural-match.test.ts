import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import type { RetrievalHit } from '@assistai/shared';
import { STRUCTURAL_CONFIG } from '@assistai/shared';
import type { SseMessageEvent } from '../completion.service';

/**
 * StructuralMatchService — unit tests.
 *
 * Tests the structural-match fast-path that bypasses LLM when a
 * high-similarity chunk (≥ 0.85) exists in the workspace's documents.
 */
describe('StructuralMatchService', () => {
  // Shared mock for RetrievalService
  const mockRetrievalService = {
    findSimilarChunks: vi.fn(),
  };

  let service: InstanceType<typeof import('../structural-match.service').StructuralMatchService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { StructuralMatchService } = await import('../structural-match.service');
    service = new StructuralMatchService(mockRetrievalService as any);
  });

  describe('findMatch', () => {
    it('returns null when findSimilarChunks returns empty array', async () => {
      mockRetrievalService.findSimilarChunks.mockResolvedValue([]);

      const result = await service.findMatch('ws-1', [0.1, 0.2, 0.3]);

      expect(result).toBeNull();
    });

    it('returns the RetrievalHit when similarity >= 0.85', async () => {
      const hit: RetrievalHit = {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        content: 'CONTRATO DE LOCACIÓN entre las partes...',
        similarity: 0.92,
        documentTitle: 'Contrato Locación 2024',
      };
      mockRetrievalService.findSimilarChunks.mockResolvedValue([hit]);

      const result = await service.findMatch('ws-1', [0.1, 0.2, 0.3]);

      expect(result).toEqual(hit);
    });

    it('returns null when queryEmbedding is empty — skips findSimilarChunks entirely', async () => {
      const result = await service.findMatch('ws-1', []);

      expect(result).toBeNull();
      expect(mockRetrievalService.findSimilarChunks).not.toHaveBeenCalled();
    });

    it('forwards the exact workspaceId to findSimilarChunks — cross-tenant isolation', async () => {
      mockRetrievalService.findSimilarChunks.mockResolvedValue([]);
      const embedding = [0.5, 0.6, 0.7];

      await service.findMatch('workspaceA', embedding);

      expect(mockRetrievalService.findSimilarChunks).toHaveBeenCalledWith(
        'workspaceA',
        embedding,
        expect.any(Object),
      );
      // Verify it was NOT called with a different workspace
      expect(mockRetrievalService.findSimilarChunks).not.toHaveBeenCalledWith(
        'workspaceB',
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('calls findSimilarChunks with topK and similarityThreshold from STRUCTURAL_CONFIG', async () => {
      mockRetrievalService.findSimilarChunks.mockResolvedValue([]);
      const embedding = [0.1, 0.2];

      await service.findMatch('ws-1', embedding);

      expect(mockRetrievalService.findSimilarChunks).toHaveBeenCalledWith(
        'ws-1',
        embedding,
        { topK: STRUCTURAL_CONFIG.topK, similarityThreshold: STRUCTURAL_CONFIG.similarityThreshold },
      );
    });

    it('propagates error when findSimilarChunks throws (DB failure)', async () => {
      mockRetrievalService.findSimilarChunks.mockRejectedValue(new Error('DB timeout'));

      await expect(service.findMatch('ws-1', [0.1, 0.2, 0.3])).rejects.toThrow('DB timeout');
    });
  });

  describe('streamTokens', () => {
    const makeHit = (overrides?: Partial<RetrievalHit>): RetrievalHit => ({
      chunkId: 'chunk-42',
      documentId: 'doc-7',
      content: 'CONTRATO DE LOCACIÓN entre las partes acuerdan lo siguiente...',
      similarity: 0.91,
      documentTitle: 'Contrato Locación 2024',
      ...overrides,
    });

    it('emits a token event with the full hit content, then a done event with metadata', () => {
      const subject = new Subject<SseMessageEvent>();
      const events: SseMessageEvent[] = [];
      subject.subscribe((e) => events.push(e));

      const hit = makeHit();
      service.streamTokens(subject, hit, 'comp-123', Date.now() - 50);

      // Should have exactly 2 events: token + done
      expect(events).toHaveLength(2);

      // First event: token with full content
      expect(events[0].type).toBe('token');
      const tokenPayload = JSON.parse(events[0].data);
      expect(tokenPayload.text).toBe(hit.content);

      // Second event: done with metadata
      expect(events[1].type).toBe('done');
      const donePayload = JSON.parse(events[1].data);
      expect(donePayload.completionId).toBe('comp-123');
      expect(donePayload.isGrounded).toBe(true);
      expect(donePayload.structuralMatch).toBe(true);
      expect(donePayload.latencyMs).toBeGreaterThanOrEqual(0);
      expect(donePayload.retrievalHits).toHaveLength(1);
      expect(donePayload.retrievalHits[0]).toEqual({
        rank: 1,
        chunkId: 'chunk-42',
        documentId: 'doc-7',
        documentTitle: 'Contrato Locación 2024',
        similarity: 0.91,
        excerpt: hit.content.slice(0, 200),
      });
    });

    it('truncates excerpt to 200 chars for long content', () => {
      const subject = new Subject<SseMessageEvent>();
      const events: SseMessageEvent[] = [];
      subject.subscribe((e) => events.push(e));

      const longContent = 'A'.repeat(500);
      const hit = makeHit({ content: longContent });
      service.streamTokens(subject, hit, 'comp-456', Date.now());

      // Token event should have full content
      const tokenPayload = JSON.parse(events[0].data);
      expect(tokenPayload.text).toBe(longContent);
      expect(tokenPayload.text).toHaveLength(500);

      // Done event excerpt should be truncated to 200
      const donePayload = JSON.parse(events[1].data);
      expect(donePayload.retrievalHits[0].excerpt).toHaveLength(200);
    });
  });
});

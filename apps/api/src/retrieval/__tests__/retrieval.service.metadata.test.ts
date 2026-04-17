import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetrievalService } from '../retrieval.service';
import { EMBEDDING_CONFIG } from '@assistai/shared';

/**
 * Retrieval service metadata filter tests — jsonb containment filtering (T-5.x, T-6.x).
 *
 * Verifies that metadata filters are correctly appended to the SQL query
 * and that the metadata field is mapped in the result.
 */

function fakeEmbedding(dim = EMBEDDING_CONFIG.dimensions): number[] {
  return Array.from({ length: dim }, () => Math.random());
}

describe('RetrievalService — metadata filters', () => {
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
    service = new RetrievalService(mockDs as any);
  });

  it('does NOT add metadata clause when no filters are provided', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding());

    const searchCall = mockManager.query.mock.calls[1];
    const sql = searchCall[0] as string;

    expect(sql).not.toContain('metadata @>');
  });

  it('does NOT add metadata clause when filters is null', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding(), { filters: null });

    const searchCall = mockManager.query.mock.calls[1];
    const sql = searchCall[0] as string;

    expect(sql).not.toContain('metadata @>');
  });

  it('does NOT add metadata clause when filters is empty object', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding(), { filters: {} });

    const searchCall = mockManager.query.mock.calls[1];
    const sql = searchCall[0] as string;

    expect(sql).not.toContain('metadata @>');
  });

  it('does NOT add metadata clause when all filter fields are undefined', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding(), {
      filters: { docType: undefined, section: undefined },
    });

    const searchCall = mockManager.query.mock.calls[1];
    const sql = searchCall[0] as string;

    expect(sql).not.toContain('metadata @>');
  });

  it('adds jsonb containment clause for docType filter', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding(), {
      filters: { docType: 'CONTRATO' },
    });

    const searchCall = mockManager.query.mock.calls[1];
    const sql = searchCall[0] as string;
    const params = searchCall[1] as unknown[];

    expect(sql).toContain('AND dc.metadata @> $5::jsonb');
    expect(params[4]).toBe('{"docType":"CONTRATO"}');
  });

  it('adds jsonb containment clause for section filter', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding(), {
      filters: { section: 'clausulas' },
    });

    const searchCall = mockManager.query.mock.calls[1];
    const sql = searchCall[0] as string;
    const params = searchCall[1] as unknown[];

    expect(sql).toContain('AND dc.metadata @> $5::jsonb');
    expect(params[4]).toBe('{"section":"clausulas"}');
  });

  it('combines multiple filter fields into one jsonb parameter', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding(), {
      filters: { docType: 'CONTRATO', section: 'clausulas', clauseType: 'confidencialidad' },
    });

    const searchCall = mockManager.query.mock.calls[1];
    const params = searchCall[1] as unknown[];
    const filterParam = JSON.parse(params[4] as string);

    expect(filterParam).toEqual({
      docType: 'CONTRATO',
      section: 'clausulas',
      clauseType: 'confidencialidad',
    });
  });

  it('selects dc.metadata in the query', async () => {
    await service.findSimilarChunks('ws-1', fakeEmbedding());

    const searchCall = mockManager.query.mock.calls[1];
    const sql = searchCall[0] as string;

    expect(sql).toContain('dc.metadata');
  });

  it('maps metadata field from row into RetrievalHit', async () => {
    const mockRows = [
      {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        content: 'Cláusula de confidencialidad...',
        similarity: 0.88,
        documentTitle: 'Contrato NDA',
        metadata: { docType: 'CONTRATO', section: 'clausulas', clauseType: 'confidencialidad', tags: [], isTemplate: false, sourceTemplateId: null },
      },
    ];

    mockManager.query.mockImplementation(async (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('SET LOCAL')) return [];
      return mockRows;
    });

    const results = await service.findSimilarChunks('ws-1', fakeEmbedding());

    expect(results[0].metadata).toEqual({
      docType: 'CONTRATO',
      section: 'clausulas',
      clauseType: 'confidencialidad',
      tags: [],
      isTemplate: false,
      sourceTemplateId: null,
    });
  });

  it('maps metadata as null when row has no metadata', async () => {
    const mockRows = [
      {
        chunkId: 'chunk-2',
        documentId: 'doc-2',
        content: 'Some text',
        similarity: 0.80,
        documentTitle: 'Doc',
        metadata: null,
      },
    ];

    mockManager.query.mockImplementation(async (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('SET LOCAL')) return [];
      return mockRows;
    });

    const results = await service.findSimilarChunks('ws-1', fakeEmbedding());

    expect(results[0].metadata).toBeNull();
  });
});

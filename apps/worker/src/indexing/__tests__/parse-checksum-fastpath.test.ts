import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParseProcessor } from '../parse.processor';

/**
 * Focused test for the checksum fast-path in ParseProcessor.
 * Verifies that when content is unchanged but embeddings are missing,
 * the embed job is re-enqueued instead of marking the doc as indexed.
 */

// ── Mocks ──────────────────────────────────────────────────────────────

const mockDocumentRepo = {
  update: vi.fn().mockResolvedValue(undefined),
  findOne: vi.fn(),
};

const mockVersionRepo = {};

const mockChunkRepo = {
  createQueryBuilder: vi.fn(),
};

const mockDataSource = {
  transaction: vi.fn(),
};

const mockEmbedQueue = {
  add: vi.fn().mockResolvedValue(undefined),
};

const mockMetadataExtractor = {};

// Minimal mock for parseDocument — we'll mock the buffer download too
vi.mock('../document-parser', () => ({
  parseDocument: vi.fn().mockResolvedValue({ success: true, text: 'test content' }),
}));

vi.mock('../chunker', () => ({
  chunkText: vi.fn().mockResolvedValue([{ content: 'chunk1', contentHash: 'h1' }]),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from('test content')),
  existsSync: vi.fn().mockReturnValue(false),
  unlinkSync: vi.fn(),
}));

function buildProcessor(): ParseProcessor {
  return new ParseProcessor(
    mockDocumentRepo as never,
    mockVersionRepo as never,
    mockChunkRepo as never,
    mockDataSource as never,
    mockEmbedQueue as never,
    mockMetadataExtractor as never,
  );
}

function fakeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      documentId: 'doc-1',
      workspaceId: 'ws-1',
      externalDocumentId: 'drive-file-1',
      mimeType: 'application/pdf',
      title: 'Test Doc',
      sizeBytes: 1024,
      filePath: '/tmp/test.pdf',
      ...overrides,
    },
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as never;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('ParseProcessor — checksum fast-path', () => {
  let processor: ParseProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = buildProcessor();
  });

  it('re-enqueues embed job when checksum matches but embeddings are missing', async () => {
    // Existing doc has same checksum
    const checksum = require('node:crypto').createHash('sha256').update('test content', 'utf-8').digest('hex');
    mockDocumentRepo.findOne.mockResolvedValue({ id: 'doc-1', checksum });

    // Chunks exist without embeddings
    const mockQb = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(3),
    };
    mockChunkRepo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await processor.process(fakeJob());

    // Should re-enqueue embed, NOT mark as indexed
    expect(mockEmbedQueue.add).toHaveBeenCalledWith(
      'embed',
      { documentId: 'doc-1', workspaceId: 'ws-1' },
      expect.objectContaining({ attempts: expect.any(Number) }),
    );

    // Should set status to processing, not indexed
    expect(mockDocumentRepo.update).toHaveBeenCalledWith('doc-1', { ingestStatus: 'processing' });

    // Should NOT have been called with indexed
    const indexedCalls = mockDocumentRepo.update.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>).ingestStatus === 'indexed',
    );
    expect(indexedCalls).toHaveLength(0);

    expect(result).toEqual({ chunks: 0, checksum });
  });

  it('marks as indexed when checksum matches and all embeddings exist', async () => {
    const checksum = require('node:crypto').createHash('sha256').update('test content', 'utf-8').digest('hex');
    mockDocumentRepo.findOne.mockResolvedValue({ id: 'doc-1', checksum });

    // All chunks have embeddings
    const mockQb = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(0),
    };
    mockChunkRepo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await processor.process(fakeJob());

    // Should NOT enqueue embed
    expect(mockEmbedQueue.add).not.toHaveBeenCalled();

    // Should mark as indexed
    expect(mockDocumentRepo.update).toHaveBeenCalledWith('doc-1', expect.objectContaining({
      ingestStatus: 'indexed',
    }));

    expect(result).toEqual({ chunks: 0, checksum });
  });
});

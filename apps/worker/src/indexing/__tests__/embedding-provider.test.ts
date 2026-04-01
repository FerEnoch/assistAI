import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIEmbeddingProvider } from '../embedding/openai-embedding.provider';

// Mock the OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: vi.fn(),
      },
    })),
  };
});

describe('OpenAIEmbeddingProvider', () => {
  let provider: OpenAIEmbeddingProvider;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    provider = new OpenAIEmbeddingProvider();
    // Access the mocked client
    mockCreate = (provider as unknown as { client: { embeddings: { create: ReturnType<typeof vi.fn> } } }).client.embeddings.create;
  });

  it('should have correct provider metadata', () => {
    expect(provider.providerName).toBe('openai');
    expect(provider.modelVersion).toBe('text-embedding-3-small-1024d');
    expect(provider.dimensions).toBe(1024);
  });

  it('should return empty array for empty input', async () => {
    const result = await provider.embedBatch([]);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should call OpenAI API with correct parameters', async () => {
    const fakeEmbedding = Array.from({ length: 1024 }, (_, i) => i * 0.001);
    mockCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: fakeEmbedding },
        { index: 1, embedding: fakeEmbedding },
      ],
    });

    const result = await provider.embedBatch(['hello', 'world']);

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      dimensions: 1024,
      input: ['hello', 'world'],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1024);
    expect(result[1]).toHaveLength(1024);
  });

  it('should sort results by index to guarantee order', async () => {
    const emb1 = Array.from({ length: 1024 }, () => 0.1);
    const emb2 = Array.from({ length: 1024 }, () => 0.2);

    // Return in wrong order
    mockCreate.mockResolvedValue({
      data: [
        { index: 1, embedding: emb2 },
        { index: 0, embedding: emb1 },
      ],
    });

    const result = await provider.embedBatch(['first', 'second']);

    // Should be sorted by index, so emb1 comes first
    expect(result[0][0]).toBeCloseTo(0.1);
    expect(result[1][0]).toBeCloseTo(0.2);
  });

  it('should output array shape [n][1024] (A-051)', async () => {
    const n = 5;
    const fakeEmbedding = Array.from({ length: 1024 }, () => Math.random());
    mockCreate.mockResolvedValue({
      data: Array.from({ length: n }, (_, i) => ({
        index: i,
        embedding: [...fakeEmbedding],
      })),
    });

    const texts = Array.from({ length: n }, (_, i) => `text ${i}`);
    const result = await provider.embedBatch(texts);

    // Assert shape is [n][1024]
    expect(result).toHaveLength(n);
    for (const embedding of result) {
      expect(embedding).toHaveLength(1024);
    }
  });

  it('should throw on dimension mismatch', async () => {
    const wrongDim = Array.from({ length: 512 }, () => 0.1);
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: wrongDim }],
    });

    await expect(provider.embedBatch(['test'])).rejects.toThrow(
      'Embedding dimension mismatch',
    );
  });
});

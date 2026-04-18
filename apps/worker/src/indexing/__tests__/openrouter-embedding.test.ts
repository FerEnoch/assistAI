import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterEmbeddingProvider } from '../embedding/openrouter-embedding.provider';

// Mock the OpenAI SDK (OpenRouter uses the same SDK with a different baseURL).
// The default export needs `.APIError` as a static property because the
// provider code references `OpenAI.APIError` (not a named import).
//
// NOTE: vi.mock is hoisted — everything inside the factory must be self-contained.
vi.mock('openai', () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  const OpenAIMock = vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn(),
    },
  })) as unknown as Record<string, unknown>;
  OpenAIMock.APIError = APIError;

  return { default: OpenAIMock, APIError };
});

/**
 * Helper to create an APIError instance from the mocked module.
 * We import it lazily to avoid hoisting issues.
 */
async function createAPIError(status: number, message: string): Promise<Error> {
  const { APIError } = await import('openai') as unknown as {
    APIError: new (status: number, message: string) => Error;
  };
  return new APIError(status, message);
}

describe('OpenRouterEmbeddingProvider', () => {
  let provider: OpenRouterEmbeddingProvider;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    provider = new OpenRouterEmbeddingProvider();
    mockCreate = (
      provider as unknown as {
        client: { embeddings: { create: ReturnType<typeof vi.fn> } };
      }
    ).client.embeddings.create;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('should have correct provider metadata', () => {
    expect(provider.providerName).toBe('openrouter');
    expect(provider.modelVersion).toBe(
      'qwen/qwen3-embedding-8b-truncated-1024d',
    );
    expect(provider.dimensions).toBe(1024);
  });

  // ── Empty input ──────────────────────────────────────────────────────

  it('should return empty array for empty input', async () => {
    const result = await provider.embedBatch([]);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // ── Correct API call ─────────────────────────────────────────────────

  it('should call OpenRouter API with correct model and baseURL', async () => {
    const fakeEmbedding = Array.from({ length: 1024 }, (_, i) => i * 0.001);
    mockCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: fakeEmbedding },
        { index: 1, embedding: fakeEmbedding },
      ],
    });

    const result = await provider.embedBatch(['hello', 'world']);

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'qwen/qwen3-embedding-8b',
      input: ['hello', 'world'],
      encoding_format: 'float',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1024);
    expect(result[1]).toHaveLength(1024);
  });

  // ── Sort by index ────────────────────────────────────────────────────

  it('should sort results by index to guarantee order', async () => {
    const emb1 = Array.from({ length: 1024 }, () => 0.1);
    const emb2 = Array.from({ length: 1024 }, () => 0.2);

    mockCreate.mockResolvedValue({
      data: [
        { index: 1, embedding: emb2 },
        { index: 0, embedding: emb1 },
      ],
    });

    const result = await provider.embedBatch(['first', 'second']);

    expect(result[0][0]).toBeCloseTo(0.1);
    expect(result[1][0]).toBeCloseTo(0.2);
  });

  // ── Shape validation ─────────────────────────────────────────────────

  it('should output array shape [n][1024]', async () => {
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

    expect(result).toHaveLength(n);
    for (const embedding of result) {
      expect(embedding).toHaveLength(1024);
    }
  });

  // ── Dimension mismatch ───────────────────────────────────────────────

  it('should throw on dimension mismatch', async () => {
    const wrongDim = Array.from({ length: 512 }, () => 0.1);
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: wrongDim }],
    });

    await expect(provider.embedBatch(['test'])).rejects.toThrow(
      'Embedding dimension mismatch',
    );
  });

  // ── Retry on 429 ────────────────────────────────────────────────────

  it('should retry on rate-limit (429) errors', async () => {
    const fakeEmbedding = Array.from({ length: 1024 }, () => 0.5);
    const rateLimitErr = await createAPIError(429, 'rate limited');

    // First call: 429, second call: success
    mockCreate
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce({
        data: [{ index: 0, embedding: fakeEmbedding }],
      });

    // Speed up retries for test
    (provider as unknown as { retryBaseDelayMs: number }).retryBaseDelayMs = 1;

    const result = await provider.embedBatch(['test']);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1024);
  });

  // ── Non-retryable errors propagate immediately ───────────────────────

  it('should NOT retry on non-retryable errors (e.g. 401)', async () => {
    const authErr = await createAPIError(401, 'unauthorized');
    mockCreate.mockRejectedValueOnce(authErr);

    (provider as unknown as { retryBaseDelayMs: number }).retryBaseDelayMs = 1;

    await expect(provider.embedBatch(['test'])).rejects.toThrow('unauthorized');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // ── Batching ─────────────────────────────────────────────────────────

  it('should split large inputs into sub-batches of 64', async () => {
    const fakeEmbedding = Array.from({ length: 1024 }, () => 0.1);

    mockCreate.mockImplementation(async ({ input }: { input: string[] }) => ({
      data: input.map((_, i) => ({
        index: i,
        embedding: [...fakeEmbedding],
      })),
    }));

    // 100 texts should be split into batches of 64 + 36
    const texts = Array.from({ length: 100 }, (_, i) => `text ${i}`);
    const result = await provider.embedBatch(texts);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(100);

    // Verify batch sizes
    const firstCallInputLength = mockCreate.mock.calls[0][0].input.length;
    const secondCallInputLength = mockCreate.mock.calls[1][0].input.length;
    expect(firstCallInputLength).toBe(64);
    expect(secondCallInputLength).toBe(36);
  });
});

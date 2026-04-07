import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryOpenRouterEmbeddingService } from '../query-openrouter-embedding.service';

// Mock the OpenAI SDK — OpenRouter uses the same SDK with a different baseURL.
// vi.mock is hoisted — everything inside the factory must be self-contained.
vi.mock('openai', () => {
  const OpenAIMock = vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn(),
    },
  })) as unknown as Record<string, unknown>;

  return { default: OpenAIMock };
});

describe('QueryOpenRouterEmbeddingService', () => {
  let service: QueryOpenRouterEmbeddingService;
  let mockCreate: ReturnType<typeof vi.fn>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    service = new QueryOpenRouterEmbeddingService();
    mockCreate = (
      service as unknown as {
        client: { embeddings: { create: ReturnType<typeof vi.fn> } };
      }
    ).client.embeddings.create;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── Returns null when API key is missing ──────────────────────────────

  it('should return null and warn when OPENROUTER_API_KEY is not configured', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const unconfigured = new QueryOpenRouterEmbeddingService();

    const result = await unconfigured.embed('test query');

    expect(result).toBeNull();
  });

  // ── Correct API call ──────────────────────────────────────────────────

  it('should call OpenRouter API with correct model and return 1024d vector', async () => {
    const fakeEmbedding = Array.from({ length: 1024 }, (_, i) => i * 0.001);
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: fakeEmbedding }],
    });

    const result = await service.embed('test query');

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
      input: 'test query',
    });
    expect(result).toHaveLength(1024);
    expect(result).toEqual(fakeEmbedding);
  });

  // ── Dimension mismatch returns null ───────────────────────────────────

  it('should return null on dimension mismatch', async () => {
    const wrongDim = Array.from({ length: 512 }, () => 0.1);
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: wrongDim }],
    });

    const result = await service.embed('test query');

    expect(result).toBeNull();
  });

  // ── API error returns null (non-fatal) ────────────────────────────────

  it('should return null on API error without throwing', async () => {
    mockCreate.mockRejectedValue(new Error('service unavailable'));

    const result = await service.embed('test query');

    expect(result).toBeNull();
  });
});

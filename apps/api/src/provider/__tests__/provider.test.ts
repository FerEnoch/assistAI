import { describe, it, expect } from 'vitest';
import { PROVIDER_CONFIG, COMPLETION_CONFIG, RATE_LIMIT_CONFIG } from '@assistai/shared';

/**
 * Provider configuration and routing tests (A-073, A-075, A-077, A-095).
 */
describe('PROVIDER_CONFIG', () => {
  it('has totalTimeoutMs of 30 seconds', () => {
    expect(PROVIDER_CONFIG.totalTimeoutMs).toBe(30_000);
  });

  it('has connectTimeoutMs of 5 seconds', () => {
    expect(PROVIDER_CONFIG.connectTimeoutMs).toBe(5_000);
  });

  it('has maxResponseBytes of 1MB', () => {
    expect(PROVIDER_CONFIG.maxResponseBytes).toBe(1_048_576);
  });

  it('uses openrouter.ai/api/v1 as base URL', () => {
    expect(PROVIDER_CONFIG.openRouterBaseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('defaults to the OpenRouter free-tier model', () => {
    expect(PROVIDER_CONFIG.defaultManagedModel).toBe('google/gemma-4-31b-it:free');
    expect(COMPLETION_CONFIG.defaultModel).toBe('google/gemma-4-31b-it:free');
  });
});

describe('RATE_LIMIT_CONFIG', () => {
  it('auth rate limit: 5 req / 15 min per IP', () => {
    expect(RATE_LIMIT_CONFIG.auth.limit).toBe(5);
    expect(RATE_LIMIT_CONFIG.auth.ttlSeconds).toBe(900);
  });

  it('completion per-minute rate limit: 60 req / 60s per user', () => {
    expect(RATE_LIMIT_CONFIG.completionsPerMinute.limit).toBe(60);
    expect(RATE_LIMIT_CONFIG.completionsPerMinute.ttlSeconds).toBe(60);
  });

  it('completion per-day rate limit: 1000 req / day per user', () => {
    expect(RATE_LIMIT_CONFIG.completionsPerDay.limit).toBe(1000);
    expect(RATE_LIMIT_CONFIG.completionsPerDay.ttlSeconds).toBe(86_400);
  });
});

describe('Provider adapter interface contract', () => {
  it('OpenRouterAdapter has required methods', async () => {
    // Verify the interface shape — actual adapter creation needs API keys
    const { OpenRouterAdapter } = await import('../../provider/openrouter.adapter');
    const adapter = new OpenRouterAdapter('test-key');

    expect(typeof adapter.streamCompletion).toBe('function');
    expect(typeof adapter.validateHealth).toBe('function');
  });

  it('ByoAdapter has required methods', async () => {
    const { ByoAdapter } = await import('../../provider/byo.adapter');
    const adapter = new ByoAdapter('https://api.example.com/v1', 'test-key', 'gpt-4');

    expect(typeof adapter.streamCompletion).toBe('function');
    expect(typeof adapter.validateHealth).toBe('function');
  });
});

describe('Weak-grounding suppression (A-083)', () => {
  it('suppresses evidence when top similarity < 0.72', async () => {
    const { RETRIEVAL_CONFIG } = await import('@assistai/shared');
    expect(RETRIEVAL_CONFIG.similarityThreshold).toBe(0.72);

    // Simulate the suppression logic from CompletionService
    const weakEvidence = [
      { chunkId: '1', documentId: 'd1', content: 'test', similarity: 0.65, documentTitle: 'Doc' },
      { chunkId: '2', documentId: 'd2', content: 'test', similarity: 0.60, documentTitle: 'Doc2' },
    ];

    let evidence = [...weakEvidence];
    let isGrounded = false;

    if (evidence.length > 0) {
      const topSimilarity = evidence[0].similarity;
      if (topSimilarity < RETRIEVAL_CONFIG.similarityThreshold) {
        evidence = [];
        isGrounded = false;
      } else {
        isGrounded = true;
      }
    }

    expect(evidence).toHaveLength(0);
    expect(isGrounded).toBe(false);
  });

  it('keeps evidence when top similarity >= 0.72', async () => {
    const { RETRIEVAL_CONFIG } = await import('@assistai/shared');

    const strongEvidence = [
      { chunkId: '1', documentId: 'd1', content: 'test', similarity: 0.85, documentTitle: 'Doc' },
      { chunkId: '2', documentId: 'd2', content: 'test', similarity: 0.78, documentTitle: 'Doc2' },
    ];

    let evidence = [...strongEvidence];
    let isGrounded = false;

    if (evidence.length > 0) {
      const topSimilarity = evidence[0].similarity;
      if (topSimilarity < RETRIEVAL_CONFIG.similarityThreshold) {
        evidence = [];
        isGrounded = false;
      } else {
        isGrounded = true;
      }
    }

    expect(evidence).toHaveLength(2);
    expect(isGrounded).toBe(true);
  });
});

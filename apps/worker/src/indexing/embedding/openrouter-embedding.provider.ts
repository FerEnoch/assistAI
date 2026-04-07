import OpenAI from 'openai';
import { Injectable, Logger } from '@nestjs/common';
import type { EmbeddingProvider } from './embedding-provider.interface';

/**
 * OpenRouter embedding provider.
 *
 * Uses `nvidia/llama-nemotron-embed-vl-1b-v2:free` via OpenRouter's
 * OpenAI-compatible `/v1/embeddings` endpoint.
 *
 * Drop-in replacement for `OpenAIEmbeddingProvider` — implements the same
 * `EmbeddingProvider` interface with identical output shape.
 *
 * The model returns 1024-dimensional embeddings natively (no `dimensions`
 * param needed).  Includes basic retry logic for rate-limit (429) errors
 * that are common on free-tier models.
 */
@Injectable()
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OpenRouterEmbeddingProvider.name);
  private readonly client: OpenAI;

  readonly providerName = 'openrouter';
  readonly modelVersion = 'nvidia/llama-nemotron-embed-vl-1b-v2:free-1024d';
  readonly dimensions = 1024;

  /** OpenRouter free-tier is slower — use smaller batches */
  private readonly maxBatchSize = 64;

  /** Retry config for rate-limit / transient errors */
  private readonly maxRetries = 3;
  private readonly retryBaseDelayMs = 1_000;

  private static readonly MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free';

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const embeddings = await this.callApiWithRetry(batch);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  // ── Private ──────────────────────────────────────────────────────────

  private async callApiWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.callApi(texts);
      } catch (err) {
        lastError = err;

        const isRetryable = this.isRetryableError(err);
        if (!isRetryable || attempt === this.maxRetries) {
          break;
        }

        const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
        this.logger.warn(
          `[Embed] Retryable error (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms…`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private async callApi(texts: string[]): Promise<number[][]> {
    this.logger.debug(`[Embed] Calling OpenRouter with ${texts.length} texts`);

    const response = await this.client.embeddings.create({
      model: OpenRouterEmbeddingProvider.MODEL,
      input: texts,
    });

    // Sort by index to guarantee order matches input
    const sorted = response.data.sort((a, b) => a.index - b.index);
    const embeddings = sorted.map((item) => item.embedding);

    // Validate dimensions
    for (let i = 0; i < embeddings.length; i++) {
      if (embeddings[i].length !== this.dimensions) {
        throw new Error(
          `Embedding dimension mismatch at index ${i}: expected ${this.dimensions}, got ${embeddings[i].length}`,
        );
      }
    }

    this.logger.debug(`[Embed] Received ${embeddings.length} embeddings (${this.dimensions}d)`);
    return embeddings;
  }

  private isRetryableError(err: unknown): boolean {
    if (err instanceof OpenAI.APIError) {
      // 429 rate-limit, 500/502/503 server errors
      return [429, 500, 502, 503].includes(err.status);
    }
    // Network errors (ECONNRESET, ETIMEDOUT, etc.)
    if (err instanceof Error && 'code' in err) {
      const code = (err as NodeJS.ErrnoException).code;
      return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code ?? '');
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

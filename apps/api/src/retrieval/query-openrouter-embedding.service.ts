import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { QueryEmbeddingPort } from './query-embedding.token';

/**
 * OpenRouter query embedding service for the API.
 *
 * Uses `nvidia/llama-nemotron-embed-vl-1b-v2:free` via OpenRouter's
 * OpenAI-compatible `/v1/embeddings` endpoint.
 *
 * Drop-in replacement for `QueryEmbeddingService` — implements the same
 * `QueryEmbeddingPort` interface with identical output shape (1024d vectors).
 *
 * Unlike the worker's batch-oriented provider, this only embeds single queries.
 * The free model returns 1024-dimensional embeddings natively (no `dimensions`
 * param needed).
 */
@Injectable()
export class QueryOpenRouterEmbeddingService implements QueryEmbeddingPort {
  private readonly logger = new Logger(QueryOpenRouterEmbeddingService.name);
  private readonly client: OpenAI;
  private readonly isConfigured: boolean;

  static readonly MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free';
  static readonly DIMENSIONS = 1024;

  private isPlaceholderKey(value: string | undefined): boolean {
    if (!value) return true;
    const normalized = value.trim().toLowerCase();
    return (
      normalized.length === 0 ||
      normalized.includes('placeholder') ||
      normalized.includes('changeme') ||
      normalized.includes('your-api-key')
    );
  }

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    this.isConfigured = !this.isPlaceholderKey(apiKey);

    if (!this.isConfigured) {
      this.logger.warn(
        '[Embedding] OPENROUTER_API_KEY missing/placeholder — query embeddings will be skipped',
      );
    }

    this.client = new OpenAI({
      apiKey: apiKey ?? '',
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  /**
   * Generate an embedding vector for a query string.
   *
   * @param text - The query text to embed
   * @returns The embedding vector (1024d), or null if generation fails (non-fatal)
   */
  async embed(text: string): Promise<number[] | null> {
    if (!this.isConfigured) {
      this.logger.warn(
        '[Embedding] Skipping query embed — OPENROUTER_API_KEY not configured. RAG retrieval will be disabled.',
      );
      return null;
    }

    try {
      const response = await this.client.embeddings.create({
        model: QueryOpenRouterEmbeddingService.MODEL,
        input: text,
      });

      const embedding = response.data[0].embedding;

      if (embedding.length !== QueryOpenRouterEmbeddingService.DIMENSIONS) {
        this.logger.error(
          `[Embedding] Dimension mismatch: expected ${QueryOpenRouterEmbeddingService.DIMENSIONS}, got ${embedding.length}`,
        );
        return null;
      }

      return embedding;
    } catch (err) {
      this.logger.warn(
        `[Embedding] Generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

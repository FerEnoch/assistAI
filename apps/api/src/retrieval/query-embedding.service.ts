import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { EMBEDDING_CONFIG } from '@assistai/shared';

/**
 * Query embedding service for the API — generates embeddings for retrieval queries (A-053).
 *
 * Uses the same model and dimensions as the worker's OpenAIEmbeddingProvider
 * to ensure vector space consistency (text-embedding-3-small, 1024d).
 *
 * This is a thin wrapper around the OpenAI API, instantiated once as a singleton.
 * Unlike the worker's batch-oriented provider, this only embeds single queries.
 */
@Injectable()
export class QueryEmbeddingService {
  private readonly logger = new Logger(QueryEmbeddingService.name);
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        '[Embedding] OPENAI_API_KEY not set — query embeddings will be unavailable',
      );
    }

    this.client = new OpenAI({ apiKey: apiKey ?? '' });
  }

  /**
   * Generate an embedding vector for a query string.
   *
   * @param text - The query text to embed (typically the last ~200 chars of prefix)
   * @returns The embedding vector, or null if generation fails (non-fatal)
   */
  async embed(text: string): Promise<number[] | null> {
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn('[Embedding] Skipping — OPENAI_API_KEY not configured');
      return null;
    }

    try {
      const response = await this.client.embeddings.create({
        model: EMBEDDING_CONFIG.model,
        dimensions: EMBEDDING_CONFIG.dimensions,
        input: text,
      });

      const embedding = response.data[0].embedding;

      if (embedding.length !== EMBEDDING_CONFIG.dimensions) {
        this.logger.error(
          `[Embedding] Dimension mismatch: expected ${EMBEDDING_CONFIG.dimensions}, got ${embedding.length}`,
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

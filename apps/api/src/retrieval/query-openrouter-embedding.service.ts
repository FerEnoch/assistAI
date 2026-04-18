import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { EMBEDDING_CONFIG } from '@assistai/shared';
import type { QueryEmbeddingPort } from './query-embedding.token';

/**
 * OpenRouter query embedding service for the API.
 *
 * Uses `qwen/qwen3-embedding-8b` via OpenRouter's
 * OpenAI-compatible `/v1/embeddings` endpoint.
 *
 * Drop-in replacement for `QueryEmbeddingService` — implements the same
 * `QueryEmbeddingPort` interface with identical output shape (1024d vectors).
 *
 * Unlike the worker's batch-oriented provider, this only embeds single queries.
 * The model returns 4096-dimensional embeddings natively. We truncate them to
 * 1024 dimensions to stay compatible with pgvector HNSW limits and
 * the existing `document_chunks.embedding vector(1024)` schema.
 */
@Injectable()
export class QueryOpenRouterEmbeddingService implements QueryEmbeddingPort {
  private readonly logger = new Logger(QueryOpenRouterEmbeddingService.name);
  private readonly client: OpenAI;
  private readonly isConfigured: boolean;

  static readonly MODEL = 'qwen/qwen3-embedding-8b';
  static readonly NATIVE_DIMENSIONS = 4096;
  static readonly DIMENSIONS = EMBEDDING_CONFIG.dimensions;

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

    if (this.isConfigured) {
      this.logger.warn(
        `[OpenRouter] ⚠ Embedding truncation active: ` +
        `${QueryOpenRouterEmbeddingService.MODEL} produces ${QueryOpenRouterEmbeddingService.NATIVE_DIMENSIONS}d natively ` +
        `but schema is vector(1024) — truncating to ${QueryOpenRouterEmbeddingService.DIMENSIONS}d. ` +
        `Index and query paths MUST use the same projection.`,
      );
    }
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
        encoding_format: 'float',
      });

      if (!Array.isArray((response as { data?: unknown[] }).data)) {
        const apiMessage = (response as { error?: { message?: string } }).error?.message;
        this.logger.warn(
          `[Embedding] Invalid OpenRouter response: ${apiMessage ?? 'missing data array'}`,
        );
        return null;
      }

      const embedding = response.data[0].embedding;

      if (embedding.length < QueryOpenRouterEmbeddingService.DIMENSIONS) {
        this.logger.error(
          `[Embedding] Dimension mismatch: expected at least ${QueryOpenRouterEmbeddingService.DIMENSIONS}, got ${embedding.length}`,
        );
        return null;
      }

      if (embedding.length !== QueryOpenRouterEmbeddingService.NATIVE_DIMENSIONS) {
        this.logger.warn(
          `[Embedding] Unexpected native dimension from model: got ${embedding.length}, expected ${QueryOpenRouterEmbeddingService.NATIVE_DIMENSIONS}`,
        );
      }

      return embedding.slice(0, QueryOpenRouterEmbeddingService.DIMENSIONS);
    } catch (err) {
      this.logger.warn(
        `[Embedding] Generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

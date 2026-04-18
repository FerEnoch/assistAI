import OpenAI from 'openai';
import { Injectable, Logger } from '@nestjs/common';
import { EMBEDDING_CONFIG } from '@assistai/shared';
import type { EmbeddingProvider } from './embedding-provider.interface';

/**
 * OpenAI embedding provider (A-051).
 *
 * Calls `qwen/qwen3-embedding-8b` with `dimensions: 2000` per backlog §2.5.
 * Batches are sent in a single API call (OpenAI supports up to 2048 inputs).
 *
 * Model version stored: "qwen/qwen3-embedding-8b-2000d"
 */
@Injectable()
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OpenAIEmbeddingProvider.name);
  private readonly client: OpenAI;

  readonly providerName = 'openai';
  readonly modelVersion = `${EMBEDDING_CONFIG.model}-${EMBEDDING_CONFIG.dimensions}d`;
  readonly dimensions = EMBEDDING_CONFIG.dimensions;

  /** Max inputs per API call — OpenAI allows up to 2048 */
  private readonly maxBatchSize = 512;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Split into sub-batches if needed
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const embeddings = await this.callApi(batch);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  private async callApi(texts: string[]): Promise<number[][]> {
    this.logger.debug(`[Embed] Calling OpenAI with ${texts.length} texts`);

    const response = await this.client.embeddings.create({
      model: EMBEDDING_CONFIG.model,
      dimensions: EMBEDDING_CONFIG.dimensions,
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
}

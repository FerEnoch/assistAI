import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@assistai/shared';
import type { EmbedJobPayload } from '@assistai/shared';
import { DocumentChunk } from '@assistai/entities';
import { OpenAIEmbeddingProvider } from './embedding/openai-embedding.provider';

/**
 * Embed processor (A-051).
 *
 * Reads chunks for a document, generates embeddings via OpenAI,
 * and writes the vectors back to `document_chunks.embedding`.
 *
 * Uses raw SQL for the pgvector UPDATE since TypeORM doesn't
 * natively support the vector type.
 */
@Processor(QUEUE_NAMES.INGESTION_EMBED, {
  concurrency: 2,
})
export class EmbedProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbedProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly embeddingProvider: OpenAIEmbeddingProvider,
  ) {
    super();
  }

  async process(job: Job<EmbedJobPayload>): Promise<{ embedded: number }> {
    const { documentId, workspaceId } = job.data;

    this.logger.log(`[Embed] Starting: doc=${documentId}`);

    // Load chunks that don't have embeddings yet
    const chunks = await this.dataSource
      .getRepository(DocumentChunk)
      .find({
        where: { documentId, workspaceId },
        order: { chunkIndex: 'ASC' },
      });

    if (chunks.length === 0) {
      this.logger.warn(`[Embed] No chunks found for doc=${documentId}`);
      return { embedded: 0 };
    }

    // Extract texts for embedding
    const texts = chunks.map((c) => c.content);

    try {
      // Generate embeddings via provider (A-051)
      const embeddings = await this.embeddingProvider.embedBatch(texts);

      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: got ${embeddings.length}, expected ${chunks.length}`,
        );
      }

      // Write embeddings to DB using raw SQL (pgvector vector type)
      await this.dataSource.transaction(async (manager) => {
        for (let i = 0; i < chunks.length; i++) {
          const vectorLiteral = `[${embeddings[i].join(',')}]`;

          await manager.query(
            `UPDATE document_chunks
             SET embedding = $1::vector,
                 model_version = $2
             WHERE id = $3`,
            [vectorLiteral, this.embeddingProvider.modelVersion, chunks[i].id],
          );
        }

        // Update document status to indexed (if it was in processing/embedding state)
        await manager.query(
          `UPDATE documents
           SET ingest_status = 'indexed',
               indexed_at = NOW(),
               error_reason = NULL
           WHERE id = $1 AND workspace_id = $2`,
          [documentId, workspaceId],
        );
      });

      this.logger.log(
        `[Embed] Complete: doc=${documentId} — ${embeddings.length} chunks embedded`,
      );

      return { embedded: embeddings.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Mark document as failed
      await this.dataSource.query(
        `UPDATE documents
         SET ingest_status = 'failed',
             error_reason = $1
         WHERE id = $2`,
        [`EMBEDDING_ERROR: ${message}`, documentId],
      );

      this.logger.error(`[Embed] Error: doc=${documentId} — ${message}`);
      throw err; // Re-throw for BullMQ retry
    }
  }
}

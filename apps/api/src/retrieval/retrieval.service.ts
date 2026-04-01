import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RETRIEVAL_CONFIG, EMBEDDING_CONFIG } from '@assistai/shared';
import type { RetrievalHit } from '@assistai/shared';

/**
 * Retrieval query service — workspace-scoped vector similarity search (A-053).
 *
 * Queries document_chunks using pgvector's cosine distance operator (<=>).
 * Enforces tenant isolation via workspace_id filter.
 *
 * Performance targets:
 * - SET hnsw.ef_search = 100 for accuracy/speed balance
 * - Top-k: 4, cosine threshold: 0.72
 * - Target latency: <80ms for retrieval query
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Find the most similar document chunks for a query embedding.
   *
   * @param workspaceId - Workspace scope (tenant isolation)
   * @param queryEmbedding - The query vector (1024 dimensions)
   * @param options - Override default top-k and threshold
   * @returns Ranked array of retrieval hits above similarity threshold
   */
  async findSimilarChunks(
    workspaceId: string,
    queryEmbedding: number[],
    options?: {
      topK?: number;
      similarityThreshold?: number;
    },
  ): Promise<RetrievalHit[]> {
    const topK = options?.topK ?? RETRIEVAL_CONFIG.topK;
    const threshold = options?.similarityThreshold ?? RETRIEVAL_CONFIG.similarityThreshold;

    // Validate embedding dimensions
    if (queryEmbedding.length !== EMBEDDING_CONFIG.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_CONFIG.dimensions}, got ${queryEmbedding.length}`,
      );
    }

    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const startMs = Date.now();

    try {
      // Set HNSW ef_search for this query (session-level, per A-053)
      await this.dataSource.query(
        `SET LOCAL hnsw.ef_search = ${RETRIEVAL_CONFIG.hnswEfSearch}`,
      );

      // Cosine distance: <=> returns distance (0 = identical, 2 = opposite)
      // Similarity = 1 - distance
      const rows = await this.dataSource.query(
        `SELECT
          dc.id AS "chunkId",
          dc.document_id AS "documentId",
          dc.content,
          (1 - (dc.embedding <=> $1::vector)) AS similarity,
          d.title AS "documentTitle"
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.workspace_id = $2
          AND dc.embedding IS NOT NULL
          AND (1 - (dc.embedding <=> $1::vector)) >= $3
        ORDER BY dc.embedding <=> $1::vector
        LIMIT $4`,
        [vectorLiteral, workspaceId, threshold, topK],
      );

      const latencyMs = Date.now() - startMs;

      // Debug logging (A-055)
      this.logger.debug(
        `[Retrieval] workspace=${workspaceId} ` +
        `results=${rows.length}/${topK} ` +
        `threshold=${threshold} ` +
        `latency=${latencyMs}ms ` +
        `topSimilarity=${rows.length > 0 ? Number(rows[0].similarity).toFixed(4) : 'N/A'}`,
      );

      if (latencyMs > 80) {
        this.logger.warn(
          `[Retrieval] Slow query: ${latencyMs}ms (target: <80ms) workspace=${workspaceId}`,
        );
      }

      return rows.map((row: Record<string, unknown>) => ({
        chunkId: row.chunkId as string,
        documentId: row.documentId as string,
        content: row.content as string,
        similarity: Number(row.similarity),
        documentTitle: (row.documentTitle as string | null) ?? null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Retrieval] Query failed: workspace=${workspaceId} error=${message}`);
      throw err;
    }
  }

  /**
   * Check if a document needs reindexing based on checksum comparison (A-054).
   *
   * Compares the current checksum on the document with the content_hash
   * on its chunks. If they differ, the document needs re-embedding.
   *
   * @returns Array of document IDs that need reindexing
   */
  async findDocumentsNeedingReindex(workspaceId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT d.id
       FROM documents d
       JOIN document_chunks dc ON dc.document_id = d.id
       WHERE d.workspace_id = $1
         AND d.ingest_status = 'indexed'
         AND d.checksum IS NOT NULL
         AND dc.content_hash IS NOT NULL
         AND d.checksum != dc.content_hash`,
      [workspaceId],
    );

    if (rows.length > 0) {
      this.logger.log(
        `[Retrieval] Found ${rows.length} documents needing reindex in workspace=${workspaceId}`,
      );
    }

    return rows.map((row: { id: string }) => row.id);
  }
}

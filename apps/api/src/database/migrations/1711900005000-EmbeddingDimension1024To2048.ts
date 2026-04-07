import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NO-OP migration kept for timeline compatibility.
 *
 * The original approach attempted to alter `document_chunks.embedding` to
 * vector(2048), but pgvector HNSW indexes support up to 2000 dimensions.
 *
 * Final approach in codebase:
 * - Keep DB schema as vector(1024)
 * - Keep HNSW index intact
 * - Project OpenRouter native 2048d embeddings to 1024d in both
 *   indexing and query paths (deterministic prefix truncation)
 */
export class EmbeddingDimension1024To20481711900005000 implements MigrationInterface {
  name = 'EmbeddingDimension1024To20481711900005000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}

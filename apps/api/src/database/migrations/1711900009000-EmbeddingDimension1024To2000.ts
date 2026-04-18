import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrate embedding column from vector(1024) to vector(2000).
 *
 * qwen3-embedding-8b produces 4096d natively with MRL (Matryoshka
 * Representation Learning) support, so prefix-truncated dimensions
 * retain semantic quality.  pgvector HNSW supports up to 2000d —
 * this migration maxes out that limit for best retrieval quality.
 *
 * ⚠ DESTRUCTIVE: drops and recreates the embedding column + HNSW index.
 * All existing embeddings are lost — a full corpus re-index is required.
 */
export class EmbeddingDimension1024To20001711900009000 implements MigrationInterface {
  name = 'EmbeddingDimension1024To20001711900009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the HNSW index first (depends on the column)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chunks_embedding_hnsw;`);

    // Recreate embedding column as vector(2000)
    await queryRunner.query(`
      ALTER TABLE document_chunks
        DROP COLUMN IF EXISTS embedding,
        ADD COLUMN embedding vector(2000);
    `);

    // Rebuild HNSW index with same tuning parameters (m=16, ef_construction=64)
    await queryRunner.query(`
      CREATE INDEX idx_chunks_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    `);

    // Reset ingest_status so workers know chunks need re-embedding
    await queryRunner.query(`
      UPDATE documents SET ingest_status = 'queued'
        WHERE ingest_status = 'indexed';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to vector(1024) — also destructive
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chunks_embedding_hnsw;`);

    await queryRunner.query(`
      ALTER TABLE document_chunks
        DROP COLUMN IF EXISTS embedding,
        ADD COLUMN embedding vector(1024);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_chunks_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    `);

    await queryRunner.query(`
      UPDATE documents SET ingest_status = 'queued'
        WHERE ingest_status = 'indexed';
    `);
  }
}

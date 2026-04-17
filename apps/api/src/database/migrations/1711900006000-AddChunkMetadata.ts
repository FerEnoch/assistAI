import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add jsonb metadata column to document_chunks for legal document
 * classification (docType, section, clauseType, tags, etc.).
 */
export class AddChunkMetadata1711900006000 implements MigrationInterface {
  name = 'AddChunkMetadata1711900006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE document_chunks ADD COLUMN metadata jsonb;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_document_chunks_metadata_gin ON document_chunks USING GIN (metadata);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_document_chunks_metadata_gin;
    `);
    await queryRunner.query(`
      ALTER TABLE document_chunks DROP COLUMN IF EXISTS metadata;
    `);
  }
}

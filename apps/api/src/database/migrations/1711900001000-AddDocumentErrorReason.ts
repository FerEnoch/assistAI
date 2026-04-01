import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 3: Add error_reason column to documents table (A-046).
 *
 * Note: ingest_status enum values (queued, processing, indexed, failed)
 * are already defined in the initial migration — no ALTER TYPE needed.
 */
export class AddDocumentErrorReason1711900001000 implements MigrationInterface {
  name = 'AddDocumentErrorReason1711900001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add error_reason column for failed documents (A-046)
    await queryRunner.query(`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS error_reason TEXT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documents
      DROP COLUMN IF EXISTS error_reason;
    `);
    // Note: PostgreSQL does not support removing enum values
  }
}

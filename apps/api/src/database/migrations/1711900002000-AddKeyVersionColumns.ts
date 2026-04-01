import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 3: Add key_version column to content_sources for credential encryption
 * key rotation (A-090) and changes_page_token for incremental Drive sync (A-043).
 *
 * Note: model_endpoints.key_version already exists in the initial migration,
 * so we do NOT add it here.
 */
export class AddKeyVersionColumns1711900002000 implements MigrationInterface {
  name = 'AddKeyVersionColumns1711900002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add key_version to content_sources for refresh token rotation
    await queryRunner.query(`
      ALTER TABLE content_sources
      ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;
    `);

    // Add changes_page_token for incremental sync (A-043)
    await queryRunner.query(`
      ALTER TABLE content_sources
      ADD COLUMN IF NOT EXISTS changes_page_token TEXT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_sources
      DROP COLUMN IF EXISTS key_version;
    `);
    await queryRunner.query(`
      ALTER TABLE content_sources
      DROP COLUMN IF EXISTS changes_page_token;
    `);
  }
}

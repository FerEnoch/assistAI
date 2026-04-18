import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `needs_reauth` value to the `source_status` enum.
 *
 * When an existing source has tokens with the old `drive.file` scope,
 * the system marks it as `needs_reauth` so the UI can prompt the user
 * to re-authenticate with the new `drive.readonly` scope (REQ-6 Scenario 6.2).
 */
export class AddNeedsReauthStatus1711900012000 implements MigrationInterface {
  name = 'AddNeedsReauthStatus1711900012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE source_status ADD VALUE IF NOT EXISTS 'needs_reauth';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values natively.
    // In practice, the value is harmless if unused after rollback.
  }
}

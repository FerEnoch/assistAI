import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add error_reason column to model_endpoints table.
 *
 * The entity defined this column but it was missing from the initial schema.
 * Stores the reason for the last validation failure when status = 'error'.
 */
export class AddModelEndpointErrorReason1711900003000 implements MigrationInterface {
  name = 'AddModelEndpointErrorReason1711900003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE model_endpoints
      ADD COLUMN IF NOT EXISTS error_reason TEXT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE model_endpoints
      DROP COLUMN IF EXISTS error_reason;
    `);
  }
}

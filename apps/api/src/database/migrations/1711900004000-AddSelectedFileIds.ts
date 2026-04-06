import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `selected_file_ids` column to `content_sources`.
 *
 * When a user selects specific files in the Drive picker, their IDs are
 * persisted here so the discovery worker indexes only those files instead
 * of the entire Drive. NULL means "index everything" (full scan / resync).
 */
export class AddSelectedFileIds1711900004000 implements MigrationInterface {
  name = 'AddSelectedFileIds1711900004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_sources
      ADD COLUMN IF NOT EXISTS selected_file_ids TEXT[] NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_sources
      DROP COLUMN IF EXISTS selected_file_ids;
    `);
  }
}

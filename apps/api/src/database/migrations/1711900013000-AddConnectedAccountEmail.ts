import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `connected_account_email` column to `content_sources`.
 *
 * Separates the OAuth account identity (email) from `root_locator` which
 * stores the display label for file selection. Previously both meanings
 * were overloaded onto `root_locator`.
 *
 * Backfills existing rows: copies current `root_locator` value into
 * `connected_account_email` when it looks like an email address.
 */
export class AddConnectedAccountEmail1711900013000 implements MigrationInterface {
  name = 'AddConnectedAccountEmail1711900013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_sources
      ADD COLUMN connected_account_email VARCHAR(320) DEFAULT NULL;
    `);

    // Backfill: copy root_locator into connected_account_email where it looks like an email
    await queryRunner.query(`
      UPDATE content_sources
      SET connected_account_email = root_locator
      WHERE root_locator IS NOT NULL
        AND root_locator LIKE '%@%'
        AND root_locator NOT LIKE '% %';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_sources DROP COLUMN IF EXISTS connected_account_email;
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make documents.source_id nullable to support synthetic documents
 * (e.g. template-generated docs that don't originate from a content source).
 */
export class MakeDocumentSourceNullable1711900008000 implements MigrationInterface {
  name = 'MakeDocumentSourceNullable1711900008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documents ALTER COLUMN source_id DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM documents WHERE source_id IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE documents ALTER COLUMN source_id SET NOT NULL;
    `);
  }
}

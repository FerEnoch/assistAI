import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create template_documents join table for M:N relationship
 * between templates and documents (corpus association).
 */
export class AddTemplateDocuments1711900010000 implements MigrationInterface {
  name = 'AddTemplateDocuments1711900010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE template_documents (
        template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (template_id, document_id)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_template_documents_template_id ON template_documents(template_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_template_documents_document_id ON template_documents(document_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_template_documents_document_id;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_template_documents_template_id;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS template_documents;`);
  }
}

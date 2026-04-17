import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create templates and template_sections tables for user-defined
 * document structure templates.
 */
export class AddTemplates1711900007000 implements MigrationInterface {
  name = 'AddTemplates1711900007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name varchar(255) NOT NULL,
        doc_type varchar(50),
        description text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE template_sections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
        name varchar(255) NOT NULL,
        content text NOT NULL,
        section_index int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_templates_workspace_id ON templates(workspace_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_template_sections_template_id ON template_sections(template_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_template_sections_template_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_templates_workspace_id;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS template_sections;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS templates;
    `);
  }
}

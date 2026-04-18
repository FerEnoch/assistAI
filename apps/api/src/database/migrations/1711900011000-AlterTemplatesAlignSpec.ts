import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align templates and template_sections schema with spec:
 * - Add is_active to templates
 * - Replace content/section_index with sample_content/order/clause_type in template_sections
 */
export class AlterTemplatesAlignSpec1711900011000 implements MigrationInterface {
  name = 'AlterTemplatesAlignSpec1711900011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // templates: add is_active
    await queryRunner.query(`
      ALTER TABLE templates
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
    `);

    // template_sections: rename content → sample_content (nullable text)
    await queryRunner.query(`
      ALTER TABLE template_sections
        RENAME COLUMN content TO sample_content;
    `);
    await queryRunner.query(`
      ALTER TABLE template_sections
        ALTER COLUMN sample_content DROP NOT NULL;
    `);

    // template_sections: rename section_index → "order"
    await queryRunner.query(`
      ALTER TABLE template_sections
        RENAME COLUMN section_index TO "order";
    `);

    // template_sections: add clause_type
    await queryRunner.query(`
      ALTER TABLE template_sections
        ADD COLUMN IF NOT EXISTS clause_type varchar(50);
    `);

    // template_sections: drop created_at/updated_at (spec doesn't include them)
    await queryRunner.query(`
      ALTER TABLE template_sections
        DROP COLUMN IF EXISTS created_at,
        DROP COLUMN IF EXISTS updated_at;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore created_at/updated_at
    await queryRunner.query(`
      ALTER TABLE template_sections
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    `);

    // Drop clause_type
    await queryRunner.query(`
      ALTER TABLE template_sections
        DROP COLUMN IF EXISTS clause_type;
    `);

    // Rename "order" back to section_index
    await queryRunner.query(`
      ALTER TABLE template_sections
        RENAME COLUMN "order" TO section_index;
    `);

    // Rename sample_content back to content
    await queryRunner.query(`
      ALTER TABLE template_sections
        ALTER COLUMN sample_content SET NOT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE template_sections
        RENAME COLUMN sample_content TO content;
    `);

    // Drop is_active
    await queryRunner.query(`
      ALTER TABLE templates
        DROP COLUMN IF EXISTS is_active;
    `);
  }
}

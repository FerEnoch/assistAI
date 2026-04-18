import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Template } from './template.entity';

@Entity('template_sections')
export class TemplateSection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'template_id' })
  templateId!: string;

  @ManyToOne(() => Template, (t) => t.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template!: Template;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int', default: 0, name: 'order' })
  order!: number;

  @Column({ type: 'text', nullable: true, name: 'sample_content' })
  sampleContent?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'clause_type' })
  clauseType?: string | null;
}

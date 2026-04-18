import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('template_sections')
export class TemplateSection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'template_id' })
  templateId!: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @ManyToOne('Template', 'sections', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template?: any;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int', name: 'section_index', default: 0 })
  sectionIndex!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

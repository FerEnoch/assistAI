import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Template } from './template.entity';
import { Document } from './document.entity';

/**
 * Join table for the M:N relationship between Templates and Documents.
 * Allows a document to be associated with multiple templates and vice versa.
 */
@Entity('template_documents')
export class TemplateDocument {
  @PrimaryColumn({ type: 'uuid', name: 'template_id' })
  templateId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'document_id' })
  documentId!: string;

  @ManyToOne(() => Template, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template?: Template;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document?: Document;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { ContentSource } from './content-source.entity';

/**
 * Ingest status lifecycle: queued → processing → indexed | failed
 * Maps to the DB enum `ingest_status` created in initial migration.
 */
export type IngestStatus = 'queued' | 'processing' | 'indexed' | 'failed';

/**
 * A document ingested from a content source.
 * Tracks external ID, MIME type, checksum for deduplication, and ingest status.
 */
@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @Column({ type: 'uuid', name: 'source_id', nullable: true })
  sourceId?: string | null;

  @ManyToOne(() => ContentSource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source?: ContentSource;

  @Column({ type: 'varchar', length: 1024, nullable: true, name: 'external_document_id' })
  externalDocumentId?: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  title?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'mime_type' })
  mimeType?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum?: string | null;

  @Column({
    type: 'enum',
    enum: ['queued', 'processing', 'indexed', 'failed'],
    default: 'queued',
    name: 'ingest_status',
  })
  ingestStatus!: IngestStatus;

  /** Error details when ingestStatus === 'failed' */
  @Column({ type: 'text', nullable: true, name: 'error_reason' })
  errorReason?: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'indexed_at' })
  indexedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('DocumentVersion', 'document')
  versions?: unknown[];

  @OneToMany('DocumentChunk', 'document')
  chunks?: unknown[];
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { Workspace } from './workspace.entity';
import type { ChunkMetadata } from '@assistai/shared';

/**
 * A chunk of a document with its embedding vector.
 *
 * The `embedding` column is vector(1024) managed by pgvector.
 * TypeORM doesn't natively support the vector type, so we use
 * `type: 'float8'` as a workaround — the actual column type is
 * defined in the migration as `vector(1024)`.
 *
 * HNSW index: m=16, ef_construction=64, vector_cosine_ops
 */
@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'document_id' })
  documentId!: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document?: Document;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @Column({ type: 'int', name: 'chunk_index' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int', nullable: true, name: 'token_count' })
  tokenCount?: number | null;

  /**
   * Embedding vector — stored as vector(1024) in PostgreSQL via pgvector.
   * We use `select: false` because raw vector data is rarely needed in queries;
   * similarity search is done via raw SQL with the <=> operator.
   */
  @Column({ type: 'varchar', nullable: true, select: false })
  embedding?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'model_version' })
  modelVersion?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true, name: 'content_hash' })
  contentHash?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: ChunkMetadata | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

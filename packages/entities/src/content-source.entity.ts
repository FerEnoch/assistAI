import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

@Entity('content_sources')
export class ContentSource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @Column({ type: 'enum', enum: ['google_drive'], name: 'source_type' })
  sourceType!: 'google_drive';

  @Column({ type: 'text', nullable: true, name: 'google_refresh_token_enc' })
  googleRefreshTokenEnc?: string | null;

  /** Key version used to encrypt the refresh token. Enables rotation (A-090). */
  @Column({ type: 'int', default: 1, name: 'key_version' })
  keyVersion!: number;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'root_locator' })
  rootLocator?: string | null;

  /** File IDs selected by the user for indexing (A-043). Null means index all. */
  @Column({ type: 'text', array: true, nullable: true, name: 'selected_file_ids' })
  selectedFileIds?: string[] | null;

  @Column({ type: 'enum', enum: ['connected', 'syncing', 'error', 'disconnected'], default: 'connected' })
  status!: 'connected' | 'syncing' | 'error' | 'disconnected';

  @Column({ type: 'timestamptz', nullable: true, name: 'last_synced_at' })
  lastSyncedAt?: Date | null;

  /** Drive changes API page token for incremental sync (A-043). */
  @Column({ type: 'text', nullable: true, name: 'changes_page_token' })
  changesPageToken?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

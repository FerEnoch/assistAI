import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';
import { EditorSession } from './editor-session.entity';

/**
 * Completion outcome status.
 */
export type CompletionOutcome = 'completed' | 'error' | 'timeout' | 'cancelled';

/**
 * Completion request — tracks each inline completion request (A-070).
 * Stores retrieval metadata, latency, and user acceptance.
 */
@Entity('completion_requests')
export class CompletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'uuid', nullable: true, name: 'editor_session_id' })
  editorSessionId?: string | null;

  @ManyToOne(() => EditorSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'editor_session_id' })
  editorSession?: EditorSession | null;

  @Column({ type: 'uuid', nullable: true, name: 'model_endpoint_id' })
  modelEndpointId?: string | null;

  @Column({ type: 'int', default: 0, name: 'retrieved_chunk_count' })
  retrievedChunkCount!: number;

  @Column({ type: 'int', nullable: true, name: 'latency_ms' })
  latencyMs?: number | null;

  @Column({ type: 'int', nullable: true, name: 'provider_latency_ms' })
  providerLatencyMs?: number | null;

  @Column({
    type: 'enum',
    enum: ['completed', 'error', 'timeout', 'cancelled'],
    nullable: true,
    name: 'outcome_status',
  })
  outcomeStatus?: CompletionOutcome | null;

  @Column({ type: 'boolean', nullable: true, name: 'accepted_by_user' })
  acceptedByUser?: boolean | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

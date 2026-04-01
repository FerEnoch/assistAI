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

/**
 * Provider type — managed (OpenRouter) or BYO (user-provided OpenAI-compatible).
 */
export type ProviderType = 'managed' | 'byo';

/**
 * Endpoint status — active after validation, or error if health check fails.
 */
export type EndpointStatus = 'active' | 'validating' | 'error';

/**
 * Model endpoint — configures a completion provider for a workspace (A-073, A-074).
 *
 * Managed endpoints use OpenRouter. BYO endpoints point to any
 * OpenAI-compatible API with an encrypted API key.
 */
@Entity('model_endpoints')
export class ModelEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @Column({ type: 'enum', enum: ['managed', 'byo'], name: 'provider_type' })
  providerType!: ProviderType;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'base_url' })
  baseUrl?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'model_name' })
  modelName?: string | null;

  @Column({ type: 'text', nullable: true, name: 'encrypted_api_key' })
  encryptedApiKey?: string | null;

  @Column({ type: 'int', default: 1, name: 'key_version' })
  keyVersion!: number;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault!: boolean;

  @Column({
    type: 'enum',
    enum: ['active', 'validating', 'error'],
    default: 'validating',
  })
  status!: EndpointStatus;

  @Column({ type: 'text', nullable: true, name: 'error_reason' })
  errorReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

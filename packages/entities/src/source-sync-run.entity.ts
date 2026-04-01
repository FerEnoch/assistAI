import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ContentSource } from './content-source.entity';

@Entity('source_sync_runs')
export class SourceSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'source_id' })
  sourceId!: string;

  @ManyToOne(() => ContentSource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source?: ContentSource;

  @Column({ type: 'timestamptz', name: 'started_at', default: () => 'NOW()' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'finished_at' })
  finishedAt?: Date | null;

  @Column({ type: 'enum', enum: ['running', 'completed', 'failed'], default: 'running' })
  status!: 'running' | 'completed' | 'failed';

  @Column({ type: 'int', name: 'discovered_count', default: 0 })
  discoveredCount!: number;

  @Column({ type: 'text', nullable: true, name: 'error_summary' })
  errorSummary?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

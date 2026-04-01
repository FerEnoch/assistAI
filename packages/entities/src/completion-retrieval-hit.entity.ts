import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CompletionRequest } from './completion-request.entity';
import { DocumentChunk } from './document-chunk.entity';

/**
 * Retrieval hit — records which chunks were used for a completion (A-055).
 * Links a completion request to the document chunks retrieved,
 * with rank and similarity score for debugging/analytics.
 */
@Entity('completion_retrieval_hits')
export class CompletionRetrievalHit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'completion_request_id' })
  completionRequestId!: string;

  @ManyToOne(() => CompletionRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'completion_request_id' })
  completionRequest?: CompletionRequest;

  @Column({ type: 'uuid', name: 'document_chunk_id' })
  documentChunkId!: string;

  @ManyToOne(() => DocumentChunk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_chunk_id' })
  documentChunk?: DocumentChunk;

  @Column({ type: 'int' })
  rank!: number;

  @Column({ type: 'real', name: 'similarity_score' })
  similarityScore!: number;
}

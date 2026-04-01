import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DocumentChunk,
  Document,
  CompletionRequest,
  CompletionRetrievalHit,
} from '@assistai/entities';
import { RetrievalService } from './retrieval.service';
import { QueryEmbeddingService } from './query-embedding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentChunk,
      Document,
      CompletionRequest,
      CompletionRetrievalHit,
    ]),
  ],
  providers: [RetrievalService, QueryEmbeddingService],
  exports: [RetrievalService, QueryEmbeddingService],
})
export class RetrievalModule {}

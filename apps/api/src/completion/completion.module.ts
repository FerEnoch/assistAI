import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EditorSession,
  CompletionRequest,
  CompletionRetrievalHit,
} from '@assistai/entities';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ProviderModule } from '../provider/provider.module';
import { CompletionController } from './completion.controller';
import { CompletionService } from './completion.service';
import { PromptAssembler } from './prompt-assembler';
import { StructuralMatchService } from './structural-match.service';
import { MetadataAwareRetrievalService } from './metadata-aware-retrieval.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EditorSession,
      CompletionRequest,
      CompletionRetrievalHit,
    ]),
    RetrievalModule,
    ProviderModule,
  ],
  controllers: [CompletionController],
  providers: [CompletionService, PromptAssembler, StructuralMatchService, MetadataAwareRetrievalService],
  exports: [CompletionService],
})
export class CompletionModule {}

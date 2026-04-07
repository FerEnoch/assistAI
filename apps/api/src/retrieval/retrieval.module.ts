import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DocumentChunk,
  Document,
  CompletionRequest,
  CompletionRetrievalHit,
} from '@assistai/entities';
import { RetrievalService } from './retrieval.service';
import { QueryEmbeddingService } from './query-embedding.service';
import { QueryOpenRouterEmbeddingService } from './query-openrouter-embedding.service';
import { QUERY_EMBEDDING } from './query-embedding.token';

const logger = new Logger('RetrievalModule');

/**
 * Resolves the concrete query-embedding provider based on
 * the `EMBEDDING_PROVIDER_NAME` env var.
 *
 * - 'openrouter' → QueryOpenRouterEmbeddingService (OPENROUTER_API_KEY)
 * - 'openai' (default) → QueryEmbeddingService (OPENAI_API_KEY)
 */
const queryEmbeddingFactory = {
  provide: QUERY_EMBEDDING,
  useFactory: () => {
    const name = (process.env.EMBEDDING_PROVIDER_NAME ?? 'openai').toLowerCase();

    switch (name) {
      case 'openrouter':
        logger.log('[Embedding] Using OpenRouter provider for query embeddings');
        return new QueryOpenRouterEmbeddingService();
      case 'openai':
      default:
        logger.log('[Embedding] Using OpenAI provider for query embeddings');
        return new QueryEmbeddingService();
    }
  },
};

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentChunk,
      Document,
      CompletionRequest,
      CompletionRetrievalHit,
    ]),
  ],
  providers: [RetrievalService, queryEmbeddingFactory],
  exports: [RetrievalService, QUERY_EMBEDDING],
})
export class RetrievalModule {}

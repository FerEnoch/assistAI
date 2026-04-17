import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES, INGESTION_RETRY_POLICY } from '@assistai/shared';
import {
  ContentSource,
  SourceSyncRun,
  Document,
  DocumentVersion,
  DocumentChunk,
} from '@assistai/entities';
import { DiscoveryProcessor } from './discovery.processor';
import { ParseProcessor } from './parse.processor';
import { EmbedProcessor } from './embed.processor';
import { EMBEDDING_PROVIDER } from './embedding/embedding-provider.token';
import { OpenAIEmbeddingProvider } from './embedding/openai-embedding.provider';
import { OpenRouterEmbeddingProvider } from './embedding/openrouter-embedding.provider';
import { MetadataExtractor } from './metadata-extractor.service';

/**
 * Resolves the concrete embedding provider based on
 * the `EMBEDDING_PROVIDER_NAME` env var.
 *
 * Defaults to `openai` if the variable is not set.
 */
const embeddingProviderFactory = {
  provide: EMBEDDING_PROVIDER,
  useFactory: () => {
    const name = (process.env.EMBEDDING_PROVIDER_NAME ?? 'openai').toLowerCase();

    switch (name) {
      case 'openrouter':
        return new OpenRouterEmbeddingProvider();
      case 'openai':
      default:
        return new OpenAIEmbeddingProvider();
    }
  },
};

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentSource,
      SourceSyncRun,
      Document,
      DocumentVersion,
      DocumentChunk,
    ]),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.INGESTION_DISCOVERY,
        defaultJobOptions: {
          attempts: INGESTION_RETRY_POLICY.maxAttempts,
          backoff: {
            type: INGESTION_RETRY_POLICY.backoffType,
            delay: INGESTION_RETRY_POLICY.backoffDelay,
          },
          removeOnComplete: 50,
          removeOnFail: 200,
        },
      },
      {
        name: QUEUE_NAMES.INGESTION_PARSE,
        defaultJobOptions: {
          attempts: INGESTION_RETRY_POLICY.maxAttempts,
          backoff: {
            type: INGESTION_RETRY_POLICY.backoffType,
            delay: INGESTION_RETRY_POLICY.backoffDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
      {
        name: QUEUE_NAMES.INGESTION_EMBED,
        defaultJobOptions: {
          attempts: INGESTION_RETRY_POLICY.maxAttempts,
          backoff: {
            type: INGESTION_RETRY_POLICY.backoffType,
            delay: INGESTION_RETRY_POLICY.backoffDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
    ),
  ],
  providers: [
    embeddingProviderFactory,
    MetadataExtractor,
    DiscoveryProcessor,
    ParseProcessor,
    EmbedProcessor,
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class IndexingModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  User,
  Workspace,
  WorkspaceMember,
  ContentSource,
  SourceSyncRun,
  Document,
  DocumentVersion,
  DocumentChunk,
  EditorSession,
  CompletionRequest,
  CompletionRetrievalHit,
  ModelEndpoint,
} from '@assistai/entities';
import { HealthModule } from './health/health.module';
import { TestJobModule } from './jobs/test-job.module';
import { IndexingModule } from './indexing/indexing.module';

/** All entities — registered once to avoid missing-metadata errors from cross-entity relations */
const ALL_ENTITIES = [
  User,
  Workspace,
  WorkspaceMember,
  ContentSource,
  SourceSyncRun,
  Document,
  DocumentVersion,
  DocumentChunk,
  EditorSession,
  CompletionRequest,
  CompletionRetrievalHit,
  ModelEndpoint,
];

@Module({
  imports: [
    // Database connection — same schema as the API
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ALL_ENTITIES,
      autoLoadEntities: false,
      synchronize: false,
      logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    }),
    // BullMQ connection
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    HealthModule,
    TestJobModule,
    IndexingModule,
  ],
})
export class WorkerModule {}

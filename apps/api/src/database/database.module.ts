import { Module } from '@nestjs/common';
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
  Template,
  TemplateSection,
  TemplateDocument,
} from '@assistai/entities';
import { dataSourceOptions } from './data-source';

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
  Template,
  TemplateSection,
  TemplateDocument,
];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      entities: ALL_ENTITIES,
      autoLoadEntities: false,
    }),
  ],
})
export class DatabaseModule {}

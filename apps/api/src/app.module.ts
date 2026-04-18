import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { SourceModule } from './source/source.module';
import { DocumentModule } from './document/document.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { ProviderModule } from './provider/provider.module';
import { CompletionModule } from './completion/completion.module';
import { SecurityModule } from './security/security.module';
import { ObservabilityModule } from './observability/observability.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { TemplateModule } from './template/template.module';
import { LibraryModule } from './library/library.module';

@Module({
  imports: [
    ObservabilityModule, // Must be first — provides logging for all modules
    DatabaseModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    HealthModule,
    AuthModule,
    SourceModule,
    DocumentModule,
    RetrievalModule,
    ProviderModule,
    CompletionModule,
    SecurityModule,
    WorkspaceModule,
    TemplateModule,
    LibraryModule,
  ],
})
export class AppModule {}

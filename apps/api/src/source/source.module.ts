import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { SourceController } from './source.controller';
import { SourceService } from './source.service';
import { DriveOAuthService } from './drive-oauth.service';
import { ContentSource, SourceSyncRun } from '@assistai/entities';
import { QUEUE_NAMES } from '@assistai/shared';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentSource, SourceSyncRun]),
    BullModule.registerQueue({
      name: QUEUE_NAMES.INGESTION_DISCOVERY,
    }),
  ],
  controllers: [SourceController],
  providers: [SourceService, DriveOAuthService],
  exports: [SourceService],
})
export class SourceModule {}

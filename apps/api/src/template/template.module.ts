import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  Template,
  TemplateSection,
  TemplateDocument,
  Document,
  DocumentChunk,
  ContentSource,
} from '@assistai/entities';
import { QUEUE_NAMES } from '@assistai/shared';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Template, TemplateSection, TemplateDocument, Document, DocumentChunk, ContentSource]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INGESTION_EMBED },
      { name: QUEUE_NAMES.INGESTION_PARSE },
    ),
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}

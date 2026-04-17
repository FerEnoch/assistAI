import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  Template,
  TemplateSection,
  Document,
  DocumentChunk,
} from '@assistai/entities';
import { QUEUE_NAMES } from '@assistai/shared';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Template, TemplateSection, Document, DocumentChunk]),
    BullModule.registerQueue({ name: QUEUE_NAMES.INGESTION_EMBED }),
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, DocumentVersion, DocumentChunk } from '@assistai/entities';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentVersion, DocumentChunk])],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}

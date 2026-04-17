import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import {
  Template,
  TemplateSection,
  Document,
  DocumentChunk,
} from '@assistai/entities';
import { QUEUE_NAMES } from '@assistai/shared';
import type { ChunkMetadata } from '@assistai/shared';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    @InjectRepository(TemplateSection)
    private readonly sectionRepo: Repository<TemplateSection>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    @InjectQueue(QUEUE_NAMES.INGESTION_EMBED)
    private readonly embedQueue: Queue,
  ) {}

  async findAll(workspaceId: string): Promise<Template[]> {
    return this.templateRepo.find({
      where: { workspaceId },
      relations: ['sections'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, workspaceId: string): Promise<Template> {
    const template = await this.templateRepo.findOne({
      where: { id, workspaceId },
      relations: ['sections'],
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async create(
    workspaceId: string,
    dto: CreateTemplateDto,
  ): Promise<Template> {
    // 1. Create template with sections
    const template = this.templateRepo.create({
      workspaceId,
      name: dto.name,
      docType: dto.docType ?? null,
      description: dto.description ?? null,
      sections: dto.sections.map((s) =>
        this.sectionRepo.create({
          name: s.name,
          content: s.content,
          sectionIndex: s.sectionIndex ?? 0,
        }),
      ),
    });

    const saved = await this.templateRepo.save(template);

    // 2. Create synthetic Document
    const doc = this.documentRepo.create({
      workspaceId,
      title: saved.name,
      externalDocumentId: `template-${saved.id}`,
      sourceId: null,
      ingestStatus: 'processing',
    });

    const savedDoc = await this.documentRepo.save(doc);

    // 3. Create DocumentChunks — one per section
    const sections = saved.sections ?? [];
    const chunks = sections.map((section) =>
      this.chunkRepo.create({
        documentId: savedDoc.id,
        workspaceId,
        content: section.content,
        chunkIndex: section.sectionIndex,
        metadata: {
          isTemplate: true,
          sourceTemplateId: saved.id,
          docType: (saved.docType as ChunkMetadata['docType']) ?? null,
          section: null,
          clauseType: null,
          tags: [],
        },
      }),
    );

    await this.chunkRepo.save(chunks);

    // 4. Enqueue embed job
    await this.embedQueue.add('embed', {
      documentId: savedDoc.id,
      workspaceId,
    });

    this.logger.log(
      `[Template] Created template=${saved.id} doc=${savedDoc.id} chunks=${chunks.length} workspace=${workspaceId}`,
    );

    return saved;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateTemplateDto,
  ): Promise<Template> {
    const template = await this.findOne(id, workspaceId);

    // Update scalar fields
    if (dto.name !== undefined) template.name = dto.name;
    if (dto.docType !== undefined) template.docType = dto.docType ?? null;
    if (dto.description !== undefined)
      template.description = dto.description ?? null;

    // Replace sections if provided
    if (dto.sections) {
      // Delete old sections
      await this.sectionRepo.delete({ templateId: id });

      template.sections = dto.sections.map((s) =>
        this.sectionRepo.create({
          templateId: id,
          name: s.name,
          content: s.content,
          sectionIndex: s.sectionIndex ?? 0,
        }),
      );
    }

    const saved = await this.templateRepo.save(template);

    // Re-index: find existing synthetic document
    if (dto.sections) {
      const existingDoc = await this.documentRepo.findOne({
        where: { externalDocumentId: `template-${id}`, workspaceId },
      });

      if (existingDoc) {
        // Delete old chunks
        await this.chunkRepo.delete({ documentId: existingDoc.id });

        existingDoc.ingestStatus = 'processing';
        await this.documentRepo.save(existingDoc);

        // Create new chunks
        const sections = saved.sections ?? [];
        const chunks = sections.map((section) =>
          this.chunkRepo.create({
            documentId: existingDoc.id,
            workspaceId,
            content: section.content,
            chunkIndex: section.sectionIndex,
            metadata: {
              isTemplate: true,
              sourceTemplateId: id,
              docType: (saved.docType as ChunkMetadata['docType']) ?? null,
              section: null,
              clauseType: null,
              tags: [],
            },
          }),
        );

        await this.chunkRepo.save(chunks);

        await this.embedQueue.add('embed', {
          documentId: existingDoc.id,
          workspaceId,
        });

        this.logger.log(
          `[Template] Re-indexed template=${id} doc=${existingDoc.id} chunks=${chunks.length}`,
        );
      }
    }

    return saved;
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const template = await this.templateRepo.findOne({
      where: { id, workspaceId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Delete synthetic document (cascades to chunks)
    const doc = await this.documentRepo.findOne({
      where: { externalDocumentId: `template-${id}`, workspaceId },
    });
    if (doc) {
      await this.documentRepo.remove(doc);
    }

    await this.templateRepo.remove(template);

    this.logger.log(
      `[Template] Deleted template=${id} workspace=${workspaceId}`,
    );
  }
}

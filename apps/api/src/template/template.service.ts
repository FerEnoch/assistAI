import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import {
  Template,
  TemplateSection,
  TemplateDocument,
  Document,
  DocumentChunk,
} from '@assistai/entities';
import { QUEUE_NAMES } from '@assistai/shared';
import type { ChunkMetadata } from '@assistai/shared';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateTemplateFromUploadDto,
  CreateTemplateFromDriveDto,
} from './dto';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    @InjectRepository(TemplateSection)
    private readonly sectionRepo: Repository<TemplateSection>,
    @InjectRepository(TemplateDocument)
    private readonly templateDocRepo: Repository<TemplateDocument>,
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

  /* ─── Corpus: M:N template <-> document ─── */

  async getTemplateDocuments(
    templateId: string,
    workspaceId: string,
  ): Promise<Document[]> {
    await this.findOne(templateId, workspaceId); // 403/404 guard

    const rows = await this.templateDocRepo.find({
      where: { templateId },
      relations: ['document'],
    });

    return rows.map((r) => r.document!);
  }

  async addDocumentToTemplate(
    templateId: string,
    documentId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.findOne(templateId, workspaceId); // guard template belongs to workspace

    const doc = await this.documentRepo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.workspaceId !== workspaceId) {
      throw new ForbiddenException('Document does not belong to this workspace');
    }

    // Upsert — ignore if already exists
    const existing = await this.templateDocRepo.findOne({
      where: { templateId, documentId },
    });
    if (existing) return;

    await this.templateDocRepo.save(
      this.templateDocRepo.create({ templateId, documentId }),
    );

    this.logger.log(
      `[Template] Added document=${documentId} to template=${templateId}`,
    );
  }

  async removeDocumentFromTemplate(
    templateId: string,
    documentId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.findOne(templateId, workspaceId); // guard

    await this.templateDocRepo.delete({ templateId, documentId });

    this.logger.log(
      `[Template] Removed document=${documentId} from template=${templateId}`,
    );
  }

  /* ─── Create template from local file upload ─── */

  async createFromUpload(
    workspaceId: string,
    dto: CreateTemplateFromUploadDto,
    file: Express.Multer.File,
  ): Promise<Template> {
    // 1. Create template (no sections — user defines them later)
    const template = this.templateRepo.create({
      workspaceId,
      name: dto.name,
      docType: dto.docType ?? null,
      description: dto.description ?? null,
      sections: [],
    });
    const savedTemplate = await this.templateRepo.save(template);

    // 2. Persist file to uploads dir
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const fileName = `${savedTemplate.id}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    // 3. Create Document (queued for ingest)
    const doc = this.documentRepo.create({
      workspaceId,
      title: dto.name,
      externalDocumentId: `upload-${savedTemplate.id}`,
      sourceId: null,
      ingestStatus: 'queued',
    });
    const savedDoc = await this.documentRepo.save(doc);

    // 4. Associate document to template
    await this.templateDocRepo.save(
      this.templateDocRepo.create({
        templateId: savedTemplate.id,
        documentId: savedDoc.id,
      }),
    );

    // 5. Enqueue embed job (worker picks up file from uploads dir)
    await this.embedQueue.add('embed', {
      documentId: savedDoc.id,
      workspaceId,
      filePath,
    });

    this.logger.log(
      `[Template] Created from upload: template=${savedTemplate.id} doc=${savedDoc.id} file=${fileName}`,
    );

    return savedTemplate;
  }

  /* ─── Create template from Google Drive file ─── */

  async createFromDrive(
    workspaceId: string,
    dto: CreateTemplateFromDriveDto,
  ): Promise<Template> {
    // Guard: validate source belongs to workspace is done in controller

    // 1. Check if fileId already exists as Document in this workspace
    let doc = await this.documentRepo.findOne({
      where: { externalDocumentId: dto.fileId, workspaceId },
    });

    // 2. Create template
    const template = this.templateRepo.create({
      workspaceId,
      name: dto.name,
      docType: dto.docType ?? null,
      description: dto.description ?? null,
      sections:
        dto.sections?.map((s) =>
          this.sectionRepo.create({ name: s.name, content: s.content, sectionIndex: 0 }),
        ) ?? [],
    });
    const savedTemplate = await this.templateRepo.save(template);

    if (!doc) {
      // 3a. Create new Document for this Drive file
      doc = this.documentRepo.create({
        workspaceId,
        title: dto.name,
        externalDocumentId: dto.fileId,
        sourceId: dto.sourceId,
        ingestStatus: 'queued',
      });
      doc = await this.documentRepo.save(doc);

      // Enqueue ingest
      await this.embedQueue.add('embed', {
        documentId: doc.id,
        workspaceId,
        driveFileId: dto.fileId,
        sourceId: dto.sourceId,
      });
    }

    // 4. Associate (or re-associate if doc already existed)
    const existing = await this.templateDocRepo.findOne({
      where: { templateId: savedTemplate.id, documentId: doc.id },
    });
    if (!existing) {
      await this.templateDocRepo.save(
        this.templateDocRepo.create({
          templateId: savedTemplate.id,
          documentId: doc.id,
        }),
      );
    }

    this.logger.log(
      `[Template] Created from Drive: template=${savedTemplate.id} doc=${doc.id} fileId=${dto.fileId}`,
    );

    return savedTemplate;
  }
}

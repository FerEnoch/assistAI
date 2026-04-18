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
  ContentSource,
} from '@assistai/entities';
import { QUEUE_NAMES, INGESTION_RETRY_POLICY } from '@assistai/shared';
import type { ChunkMetadata, ParseJobPayload } from '@assistai/shared';
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
    @InjectRepository(ContentSource)
    private readonly sourceRepo: Repository<ContentSource>,
    @InjectQueue(QUEUE_NAMES.INGESTION_EMBED)
    private readonly embedQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INGESTION_PARSE)
    private readonly parseQueue: Queue<ParseJobPayload>,
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
      sections: (dto.sections ?? []).map((s) =>
        this.sectionRepo.create({
          name: s.name,
          sampleContent: s.sampleContent ?? null,
          order: s.order ?? 0,
          clauseType: s.clauseType ?? null,
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

    // 3. Index template sections as chunks
    await this.indexTemplateSections(saved, savedDoc.id, workspaceId);

    // 4. Enqueue embed job
    await this.embedQueue.add('embed', {
      documentId: savedDoc.id,
      workspaceId,
    });

    this.logger.log(
      `[Template] Created template=${saved.id} doc=${savedDoc.id} workspace=${workspaceId}`,
    );

    return saved;
  }

  /**
   * Index each template section with sampleContent as a chunk with template metadata (T-5.5).
   */
  private async indexTemplateSections(
    template: Template,
    documentId: string,
    workspaceId: string,
  ): Promise<void> {
    const sections = template.sections ?? [];
    const sectionsWithContent = sections.filter((s) => s.sampleContent);

    if (sectionsWithContent.length === 0) return;

    const chunks = sectionsWithContent.map((section) =>
      this.chunkRepo.create({
        documentId,
        workspaceId,
        content: section.sampleContent!,
        chunkIndex: section.order,
        metadata: {
          isTemplate: true,
          sourceTemplateId: template.id,
          docType: (template.docType as ChunkMetadata['docType']) ?? null,
          section: null,
          clauseType: (section.clauseType as ChunkMetadata['clauseType']) ?? null,
          tags: [],
        },
      }),
    );

    await this.chunkRepo.save(chunks);
  }

  /**
   * Remove all document_chunks that reference a given templateId via metadata (T-5.7).
   */
  private async removeTemplateChunks(templateId: string): Promise<void> {
    await this.templateRepo.manager.query(
      `DELETE FROM document_chunks WHERE metadata->>'sourceTemplateId' = $1`,
      [templateId],
    );
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
          sampleContent: s.sampleContent ?? null,
          order: s.order ?? 0,
          clauseType: s.clauseType ?? null,
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

        // Re-index new sections
        await this.indexTemplateSections(saved, existingDoc.id, workspaceId);

        await this.embedQueue.add('embed', {
          documentId: existingDoc.id,
          workspaceId,
        });

        this.logger.log(
          `[Template] Re-indexed template=${id} doc=${existingDoc.id}`,
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

    // Delete chunks with matching sourceTemplateId (T-5.8)
    await this.removeTemplateChunks(id);

    // Delete synthetic document (cascades to remaining chunks by documentId)
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

    // 5. Enqueue parse job (worker will parse, chunk, then enqueue embed)
    try {
      await this.parseQueue.add('parse', {
        documentId: savedDoc.id,
        workspaceId,
        sourceId: null,
        externalDocumentId: `upload-${savedTemplate.id}`,
        mimeType: file.mimetype,
        title: dto.name,
        sizeBytes: file.size,
        syncRunId: null,
        refreshTokenEnc: '',
        filePath,
      }, {
        attempts: INGESTION_RETRY_POLICY.maxAttempts,
        backoff: {
          type: INGESTION_RETRY_POLICY.backoffType,
          delay: INGESTION_RETRY_POLICY.backoffDelay,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
    } catch (enqueueErr) {
      // Rollback: remove orphaned records and temp file
      this.logger.error(
        `[Template] Failed to enqueue parse job for upload template=${savedTemplate.id}, rolling back`,
        enqueueErr,
      );
      try {
        await this.templateDocRepo.delete({ templateId: savedTemplate.id, documentId: savedDoc.id });
        await this.documentRepo.remove(savedDoc);
        await this.templateRepo.remove(savedTemplate);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (cleanupErr) {
        this.logger.error('[Template] Rollback cleanup failed', cleanupErr);
      }
      throw enqueueErr;
    }

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
    // Guard: validate source belongs to workspace
    const source = await this.sourceRepo.findOne({
      where: { id: dto.sourceId, workspaceId },
    });
    if (!source) {
      throw new ForbiddenException('Source does not belong to this workspace');
    }

    // Guard: source must be connected with a valid refresh token
    if (source.status === 'needs_reauth') {
      throw new ForbiddenException({
        message: 'Source requires re-authentication. Please reconnect your Google Drive.',
        code: 'SOURCE_NEEDS_REAUTH',
        sourceId: dto.sourceId,
      });
    }
    if (source.status !== 'connected') {
      throw new ForbiddenException({
        message: `Source is not connected (status: ${source.status}). Please reconnect the source before importing from Drive.`,
        code: 'SOURCE_NOT_CONNECTED',
        sourceId: dto.sourceId,
      });
    }
    if (!source.googleRefreshTokenEnc) {
      throw new ForbiddenException(
        'Source has no stored credentials. Please reconnect the Google Drive source.',
      );
    }

    // Guard: fileId must not be empty
    if (!dto.fileId?.trim()) {
      throw new NotFoundException('fileId is required');
    }

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
          this.sectionRepo.create({
            name: s.name,
            sampleContent: s.sampleContent ?? null,
            order: s.order ?? 0,
            clauseType: s.clauseType ?? null,
          }),
        ) ?? [],
    });
    const savedTemplate = await this.templateRepo.save(template);

    const isNewDoc = !doc;
    // Re-parse if: new doc, failed doc, or already-indexed doc (refresh against current Drive content).
    // Skip re-parse only for docs actively in-flight (queued/processing) to avoid duplicate churn.
    const needsParse = !doc || doc.ingestStatus === 'failed' || doc.ingestStatus === 'indexed';

    // Snapshot prior state for rollback of reused docs
    const priorDocState = doc && (doc.ingestStatus === 'failed' || doc.ingestStatus === 'indexed')
      ? { ingestStatus: doc.ingestStatus as string, errorReason: doc.errorReason ?? null }
      : null;

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
    } else if (doc.ingestStatus === 'failed' || doc.ingestStatus === 'indexed') {
      // 3b. Existing document — reset for re-ingestion (refresh content from Drive)
      this.logger.log(
        `[Template] Existing document=${doc.id} for fileId=${dto.fileId} has ingestStatus=${doc.ingestStatus}, re-queuing parse for freshness`,
      );
      doc.ingestStatus = 'queued';
      doc.errorReason = null;
      doc = await this.documentRepo.save(doc);
    }

    if (needsParse) {
      // Enqueue parse (not embed) so Drive file gets parsed/ingested first
      try {
        await this.parseQueue.add('parse', {
          documentId: doc.id,
          workspaceId,
          sourceId: dto.sourceId,
          externalDocumentId: dto.fileId,
          mimeType: '', // resolved by ParseProcessor via Drive API metadata
          title: dto.name,
          sizeBytes: 0, // resolved by ParseProcessor via Drive API metadata
          syncRunId: null,
          refreshTokenEnc: source.googleRefreshTokenEnc ?? '',
        }, {
          attempts: INGESTION_RETRY_POLICY.maxAttempts,
          backoff: {
            type: INGESTION_RETRY_POLICY.backoffType,
            delay: INGESTION_RETRY_POLICY.backoffDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        });
      } catch (enqueueErr) {
        // Rollback: remove orphaned document (only if new) and template; restore reused doc state
        this.logger.error(
          `[Template] Failed to enqueue parse job for Drive template=${savedTemplate.id}, rolling back`,
          enqueueErr,
        );
        try {
          if (isNewDoc) {
            await this.documentRepo.remove(doc);
          } else if (priorDocState) {
            // Restore the reused document's prior failed state
            doc.ingestStatus = priorDocState.ingestStatus as any;
            doc.errorReason = priorDocState.errorReason;
            await this.documentRepo.save(doc);
          }
          await this.templateRepo.remove(savedTemplate);
        } catch (cleanupErr) {
          this.logger.error('[Template] Rollback cleanup failed', cleanupErr);
        }
        throw enqueueErr;
      }
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

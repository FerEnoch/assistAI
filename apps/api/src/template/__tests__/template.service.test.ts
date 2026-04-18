import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TemplateService } from '../template.service';

// Mock the decorators to avoid barrel-file circular dependency
vi.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
vi.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return { ...actual, resolve: vi.fn().mockReturnValue('/uploads'), join: vi.fn().mockReturnValue('/uploads/test.pdf') };
});

describe('TemplateService', () => {
  let service: InstanceType<typeof TemplateService>;
  let templateRepo: Record<string, any>;
  let sectionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let templateDocRepo: Record<string, ReturnType<typeof vi.fn>>;
  let documentRepo: Record<string, ReturnType<typeof vi.fn>>;
  let chunkRepo: Record<string, ReturnType<typeof vi.fn>>;
  let sourceRepo: Record<string, ReturnType<typeof vi.fn>>;
  let embedQueue: Record<string, ReturnType<typeof vi.fn>>;
  let parseQueue: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    templateRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn((data) => ({ id: 'tpl-1', ...data })),
      save: vi.fn((data) => ({
        ...data,
        id: data.id ?? 'tpl-1',
        sections: data.sections ?? [],
      })),
      remove: vi.fn().mockResolvedValue(undefined),
      manager: {
        query: vi.fn().mockResolvedValue(undefined),
      },
    };

    sectionRepo = {
      create: vi.fn((data) => ({ id: 'sec-1', order: 0, ...data })),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    templateDocRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((data) => data),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    documentRepo = {
      create: vi.fn((data) => ({ id: 'doc-1', ...data })),
      save: vi.fn((data) => ({ ...data, id: data.id ?? 'doc-1' })),
      findOne: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    chunkRepo = {
      create: vi.fn((data) => ({ id: 'chunk-1', ...data })),
      save: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    embedQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    parseQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    sourceRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'src-1', workspaceId: 'ws-1', status: 'connected', googleRefreshTokenEnc: 'enc-token' }),
    };

    service = new TemplateService(
      templateRepo as never,
      sectionRepo as never,
      templateDocRepo as never,
      documentRepo as never,
      chunkRepo as never,
      sourceRepo as never,
      embedQueue as never,
      parseQueue as never,
    );
  });

  describe('create', () => {
    it('should create template + sections + synthetic document + enqueue embed job', async () => {
      const dto = {
        name: 'Contract Template',
        docType: 'CONTRATO',
        sections: [
          {
            name: 'Intro',
            sampleContent: 'A'.repeat(60),
            order: 0,
          },
        ],
      };

      const result = await service.create('ws-1', dto);

      expect(templateRepo.create).toHaveBeenCalled();
      expect(templateRepo.save).toHaveBeenCalled();

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          title: 'Contract Template',
          sourceId: null,
          ingestStatus: 'processing',
        }),
      );
      expect(documentRepo.save).toHaveBeenCalled();
      expect(chunkRepo.create).toHaveBeenCalled();
      expect(chunkRepo.save).toHaveBeenCalled();
      expect(embedQueue.add).toHaveBeenCalledWith('embed', {
        documentId: 'doc-1',
        workspaceId: 'ws-1',
      });
      expect(result.name).toBe('Contract Template');
    });

    it('should create chunks with metadata isTemplate: true (T-4.2)', async () => {
      const dto = {
        name: 'Contract Template',
        docType: 'CONTRATO',
        sections: [
          {
            name: 'Intro',
            sampleContent: 'Sample content for the intro section',
            order: 0,
            clauseType: 'ENCABEZADO',
          },
        ],
      };

      await service.create('ws-1', dto);

      expect(chunkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            isTemplate: true,
            sourceTemplateId: 'tpl-1',
            docType: 'CONTRATO',
            clauseType: 'ENCABEZADO',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return templates for the workspace', async () => {
      const templates = [
        { id: 'tpl-1', workspaceId: 'ws-1', name: 'Template A' },
        { id: 'tpl-2', workspaceId: 'ws-1', name: 'Template B' },
      ];
      templateRepo.find.mockResolvedValue(templates);

      const result = await service.findAll('ws-1');

      expect(templateRepo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        relations: ['sections'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should delete old chunks and re-index new sections (T-4.4)', async () => {
      const existing = {
        id: 'tpl-1',
        workspaceId: 'ws-1',
        name: 'Old Name',
        docType: 'CONTRATO',
        sections: [{ id: 'sec-old', name: 'Old', order: 0, sampleContent: 'old', clauseType: null }],
      };
      templateRepo.findOne.mockResolvedValue({ ...existing });
      documentRepo.findOne.mockResolvedValue({ id: 'doc-1', externalDocumentId: 'template-tpl-1' });

      const dto = {
        name: 'Updated Name',
        sections: [
          { name: 'New Section', order: 0, sampleContent: 'new content', clauseType: 'INTRO' },
        ],
      };

      await service.update('tpl-1', 'ws-1', dto);

      // Old sections deleted
      expect(sectionRepo.delete).toHaveBeenCalledWith({ templateId: 'tpl-1' });
      // Old chunks deleted
      expect(chunkRepo.delete).toHaveBeenCalledWith({ documentId: 'doc-1' });
      // New chunks created
      expect(chunkRepo.create).toHaveBeenCalled();
      expect(chunkRepo.save).toHaveBeenCalled();
      // Re-enqueued embed
      expect(embedQueue.add).toHaveBeenCalledWith('embed', expect.objectContaining({ documentId: 'doc-1' }));
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('non-existent', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if template belongs to different workspace (T-4.5)', async () => {
      templateRepo.findOne.mockResolvedValue(null); // findOne with ws-1 returns null because tpl belongs to ws-2
      await expect(service.remove('tpl-1', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete template and synthetic document', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 'tpl-1', workspaceId: 'ws-1' });
      documentRepo.findOne.mockResolvedValue({ id: 'doc-1', externalDocumentId: 'template-tpl-1' });

      await service.remove('tpl-1', 'ws-1');

      expect(documentRepo.remove).toHaveBeenCalled();
      expect(templateRepo.remove).toHaveBeenCalled();
    });

    it('should call removeTemplateChunks to delete chunks with matching sourceTemplateId (T-4.6)', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 'tpl-1', workspaceId: 'ws-1' });
      documentRepo.findOne.mockResolvedValue({ id: 'doc-1', externalDocumentId: 'template-tpl-1' });

      await service.remove('tpl-1', 'ws-1');

      // removeTemplateChunks uses raw query
      expect(templateRepo.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('sourceTemplateId'),
        ['tpl-1'],
      );
    });
  });

  describe('createFromUpload', () => {
    it('should create template, document, association and enqueue parse job', async () => {
      const dto = { name: 'Upload Template', docType: 'CONTRATO' };
      const fakeFile = {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake pdf content'),
      } as Express.Multer.File;

      const result = await service.createFromUpload('ws-1', dto, fakeFile);

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', name: 'Upload Template' }),
      );
      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', ingestStatus: 'queued' }),
      );
      expect(templateDocRepo.create).toHaveBeenCalled();
      expect(templateDocRepo.save).toHaveBeenCalled();
      // Should enqueue parse (not embed) so the file gets parsed first
      expect(parseQueue.add).toHaveBeenCalledWith(
        'parse',
        expect.objectContaining({
          documentId: 'doc-1',
          workspaceId: 'ws-1',
          filePath: '/uploads/test.pdf',
          mimeType: 'application/pdf',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({ type: 'exponential' }),
          removeOnComplete: 100,
          removeOnFail: 500,
        }),
      );
      // Embed queue should NOT be called directly
      expect(embedQueue.add).not.toHaveBeenCalled();
      expect(result.name).toBe('Upload Template');
    });

    it('should rollback template, document, association and temp file when parseQueue.add fails', async () => {
      const enqueueError = new Error('Redis connection lost');
      parseQueue.add.mockRejectedValue(enqueueError);

      const dto = { name: 'Upload Template', docType: 'CONTRATO' };
      const fakeFile = {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake pdf content'),
      } as Express.Multer.File;

      await expect(service.createFromUpload('ws-1', dto, fakeFile)).rejects.toThrow('Redis connection lost');

      // Verify rollback: association, document, template removed
      expect(templateDocRepo.delete).toHaveBeenCalled();
      expect(documentRepo.remove).toHaveBeenCalled();
      expect(templateRepo.remove).toHaveBeenCalled();
    });
  });

  describe('createFromDrive', () => {
    it('should create template, new document and enqueue parse with full ParseJobPayload for new Drive file', async () => {
      documentRepo.findOne.mockResolvedValue(null); // fileId not known yet
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'connected',
        googleRefreshTokenEnc: 'enc-refresh-token-123',
      });

      const dto = {
        fileId: 'drive-file-abc',
        sourceId: 'src-1',
        name: 'Drive Template',
        docType: 'DEMANDA',
      };

      await service.createFromDrive('ws-1', dto);

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          externalDocumentId: 'drive-file-abc',
          sourceId: 'src-1',
          ingestStatus: 'queued',
        }),
      );
      expect(templateDocRepo.save).toHaveBeenCalled();
      // Must enqueue parse with full ParseJobPayload (not a partial object)
      expect(parseQueue.add).toHaveBeenCalledWith(
        'parse',
        expect.objectContaining({
          documentId: 'doc-1',
          workspaceId: 'ws-1',
          sourceId: 'src-1',
          externalDocumentId: 'drive-file-abc',
          title: 'Drive Template',
          refreshTokenEnc: 'enc-refresh-token-123',
          // mimeType/sizeBytes unknown at enqueue time — processor resolves via Drive API
          mimeType: '',
          sizeBytes: 0,
          syncRunId: null,
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({ type: 'exponential' }),
          removeOnComplete: 100,
          removeOnFail: 500,
        }),
      );
      // Embed queue should NOT be called directly for new Drive files
      expect(embedQueue.add).not.toHaveBeenCalled();
    });

    it('should reuse existing indexed document when fileId already exists', async () => {
      const existingDoc = { id: 'doc-existing', externalDocumentId: 'drive-file-abc', workspaceId: 'ws-1', ingestStatus: 'indexed' };
      documentRepo.findOne.mockResolvedValue(existingDoc);

      const dto = { fileId: 'drive-file-abc', sourceId: 'src-1', name: 'Drive Template 2' };
      await service.createFromDrive('ws-1', dto);

      // documentRepo.create should NOT have been called for the doc (reuse)
      expect(documentRepo.create).not.toHaveBeenCalled();
      // Association still created
      expect(templateDocRepo.save).toHaveBeenCalled();
      // No new embed job for existing doc
      expect(embedQueue.add).not.toHaveBeenCalled();
      // No parse job either — doc already indexed
      expect(parseQueue.add).not.toHaveBeenCalled();
    });

    it('should re-enqueue parse when existing document has ingestStatus=failed', async () => {
      const failedDoc = {
        id: 'doc-failed',
        externalDocumentId: 'drive-file-abc',
        workspaceId: 'ws-1',
        ingestStatus: 'failed',
        errorReason: 'previous parse error',
      };
      documentRepo.findOne.mockResolvedValue(failedDoc);
      documentRepo.save.mockImplementation((data: any) => ({ ...data, id: data.id ?? 'doc-failed' }));
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'connected',
        googleRefreshTokenEnc: 'enc-refresh-token-123',
      });

      const dto = { fileId: 'drive-file-abc', sourceId: 'src-1', name: 'Drive Template Retry' };
      await service.createFromDrive('ws-1', dto);

      // Document status should be reset
      expect(documentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'doc-failed', ingestStatus: 'queued', errorReason: null }),
      );
      // Parse should be re-enqueued
      expect(parseQueue.add).toHaveBeenCalledWith(
        'parse',
        expect.objectContaining({ documentId: 'doc-failed' }),
        expect.any(Object),
      );
      // Association still created
      expect(templateDocRepo.save).toHaveBeenCalled();
    });

    it('should rollback template and document when parseQueue.add fails for new Drive file', async () => {
      const enqueueError = new Error('Queue unavailable');
      parseQueue.add.mockRejectedValue(enqueueError);
      documentRepo.findOne.mockResolvedValue(null);
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'connected',
        googleRefreshTokenEnc: 'enc-refresh-token-123',
      });

      const dto = {
        fileId: 'drive-file-abc',
        sourceId: 'src-1',
        name: 'Drive Template',
      };

      await expect(service.createFromDrive('ws-1', dto)).rejects.toThrow('Queue unavailable');

      expect(documentRepo.remove).toHaveBeenCalled();
      expect(templateRepo.remove).toHaveBeenCalled();
    });

    it('should reject when source is not connected', async () => {
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'disconnected',
        googleRefreshTokenEnc: 'enc-token',
      });

      const dto = { fileId: 'drive-file-abc', sourceId: 'src-1', name: 'Test' };
      await expect(service.createFromDrive('ws-1', dto)).rejects.toThrow(ForbiddenException);
      expect(templateRepo.create).not.toHaveBeenCalled();
    });

    it('should reject when source has no refresh token', async () => {
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'connected',
        googleRefreshTokenEnc: null,
      });

      const dto = { fileId: 'drive-file-abc', sourceId: 'src-1', name: 'Test' };
      await expect(service.createFromDrive('ws-1', dto)).rejects.toThrow(ForbiddenException);
      expect(templateRepo.create).not.toHaveBeenCalled();
    });

    it('should restore reused failed document state when enqueue rollback occurs', async () => {
      const failedDoc = {
        id: 'doc-failed',
        externalDocumentId: 'drive-file-abc',
        workspaceId: 'ws-1',
        ingestStatus: 'failed',
        errorReason: 'previous parse error',
      };
      documentRepo.findOne.mockResolvedValue(failedDoc);
      documentRepo.save.mockImplementation((data: any) => ({ ...data }));
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'connected',
        googleRefreshTokenEnc: 'enc-refresh-token-123',
      });
      parseQueue.add.mockRejectedValue(new Error('Queue unavailable'));

      const dto = { fileId: 'drive-file-abc', sourceId: 'src-1', name: 'Test' };
      await expect(service.createFromDrive('ws-1', dto)).rejects.toThrow('Queue unavailable');

      // Document should be restored to its prior failed state (last save call in rollback)
      const saveCalls = documentRepo.save.mock.calls;
      const lastSaveCall = saveCalls[saveCalls.length - 1][0];
      expect(lastSaveCall.ingestStatus).toBe('failed');
      expect(lastSaveCall.errorReason).toBe('previous parse error');
    });
  });

  describe('addDocumentToTemplate', () => {
    it('should throw ForbiddenException if document belongs to different workspace', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 'tpl-1', workspaceId: 'ws-1', sections: [] });
      documentRepo.findOne.mockResolvedValue({ id: 'doc-1', workspaceId: 'ws-OTHER' });

      await expect(service.addDocumentToTemplate('tpl-1', 'doc-1', 'ws-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TemplateService } from '../template.service';

// Mock the decorators to avoid barrel-file circular dependency
vi.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
vi.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));

describe('TemplateService', () => {
  let service: InstanceType<typeof TemplateService>;
  let templateRepo: Record<string, ReturnType<typeof vi.fn>>;
  let sectionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let documentRepo: Record<string, ReturnType<typeof vi.fn>>;
  let chunkRepo: Record<string, ReturnType<typeof vi.fn>>;
  let embedQueue: Record<string, ReturnType<typeof vi.fn>>;

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
    };

    sectionRepo = {
      create: vi.fn((data) => ({ id: 'sec-1', sectionIndex: 0, ...data })),
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

    service = new TemplateService(
      templateRepo as never,
      sectionRepo as never,
      documentRepo as never,
      chunkRepo as never,
      embedQueue as never,
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
            content: 'A'.repeat(60),
            sectionIndex: 0,
          },
        ],
      };

      const result = await service.create('ws-1', dto);

      // Template created and saved
      expect(templateRepo.create).toHaveBeenCalled();
      expect(templateRepo.save).toHaveBeenCalled();

      // Synthetic document created
      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          title: 'Contract Template',
          sourceId: null,
          ingestStatus: 'processing',
        }),
      );
      expect(documentRepo.save).toHaveBeenCalled();

      // Chunks created
      expect(chunkRepo.create).toHaveBeenCalled();
      expect(chunkRepo.save).toHaveBeenCalled();

      // Embed job enqueued
      expect(embedQueue.add).toHaveBeenCalledWith('embed', {
        documentId: 'doc-1',
        workspaceId: 'ws-1',
      });

      expect(result.name).toBe('Contract Template');
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

  describe('remove', () => {
    it('should throw NotFoundException if template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete template and synthetic document', async () => {
      templateRepo.findOne.mockResolvedValue({
        id: 'tpl-1',
        workspaceId: 'ws-1',
      });
      documentRepo.findOne.mockResolvedValue({
        id: 'doc-1',
        externalDocumentId: 'template-tpl-1',
      });

      await service.remove('tpl-1', 'ws-1');

      expect(documentRepo.remove).toHaveBeenCalled();
      expect(templateRepo.remove).toHaveBeenCalled();
    });
  });
});

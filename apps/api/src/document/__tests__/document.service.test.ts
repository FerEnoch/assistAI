import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DocumentService } from '../document.service';

describe('DocumentService (A-045, A-046)', () => {
  let service: DocumentService;
  let documentRepo: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    documentRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    service = new DocumentService(documentRepo as never);
  });

  describe('getDocuments', () => {
    it('should return documents for a workspace', async () => {
      const docs = [
        { id: 'doc-1', workspaceId: 'ws-1', ingestStatus: 'indexed' },
        { id: 'doc-2', workspaceId: 'ws-1', ingestStatus: 'queued' },
      ];
      documentRepo.find.mockResolvedValue(docs);

      const result = await service.getDocuments('ws-1');

      expect(documentRepo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('should filter by status when provided', async () => {
      documentRepo.find.mockResolvedValue([]);

      await service.getDocuments('ws-1', 'failed');

      expect(documentRepo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', ingestStatus: 'failed' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getDocument', () => {
    it('should return a document by ID', async () => {
      const doc = { id: 'doc-1', workspaceId: 'ws-1', ingestStatus: 'indexed' };
      documentRepo.findOne.mockResolvedValue(doc);

      const result = await service.getDocument('doc-1', 'ws-1');
      expect(result.id).toBe('doc-1');
    });

    it('should throw NotFoundException for non-existent document', async () => {
      documentRepo.findOne.mockResolvedValue(null);

      await expect(service.getDocument('non-existent', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatusCounts', () => {
    it('should return counts for all status values', async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { status: 'indexed', count: '5' },
          { status: 'queued', count: '2' },
          { status: 'failed', count: '1' },
        ]),
      };
      documentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStatusCounts('ws-1');

      expect(result.indexed).toBe(5);
      expect(result.queued).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.processing).toBe(0);
    });
  });
});

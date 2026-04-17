import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentService } from '../document.service';

describe('DocumentService — getCorpusStats', () => {
  let service: DocumentService;
  let documentRepo: Record<string, ReturnType<typeof vi.fn>>;
  let chunkRepo: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const docQb = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(10),
    };

    documentRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      remove: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(docQb),
    };

    const chunkQb = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        { docType: 'CONTRATO', count: '15' },
        { docType: 'DEMANDA', count: '5' },
        { docType: null, count: '10' },
      ]),
    };

    chunkRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(chunkQb),
    };

    service = new DocumentService(
      documentRepo as never,
      chunkRepo as never,
    );
  });

  it('should return corpus stats with correct totals and percentages', async () => {
    const stats = await service.getCorpusStats('ws-1');

    expect(stats.totalDocuments).toBe(10);
    expect(stats.totalChunks).toBe(30);
    expect(stats.docTypeBreakdown).toHaveLength(3);

    const contrato = stats.docTypeBreakdown.find(
      (d) => d.docType === 'CONTRATO',
    );
    expect(contrato?.count).toBe(15);
    expect(contrato?.percentage).toBe(50);
  });
});

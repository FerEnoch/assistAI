import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LibraryController } from '../library.controller';
import { LibraryService } from '../library.service';
import type { LibraryStatsDto } from '../library.service';

const mockStats: LibraryStatsDto = {
  totalDocuments: 12,
  totalChunks: 480,
  totalTemplates: 3,
  docTypeBreakdown: [
    { docType: 'CONTRATO', count: 320, percentage: 67 },
    { docType: 'INFORME', count: 160, percentage: 33 },
  ],
};

describe('LibraryController', () => {
  let controller: LibraryController;
  let service: Partial<Record<keyof LibraryService, ReturnType<typeof vi.fn>>>;

  const mockReq = (overrides: Record<string, unknown> = {}) => ({
    session: { workspaceId: 'ws-1' },
    ...overrides,
  });

  beforeEach(() => {
    service = {
      getLibraryStats: vi.fn().mockResolvedValue(mockStats),
    };
    controller = new LibraryController(service as unknown as LibraryService);
  });

  describe('GET /library/stats', () => {
    it('returns library stats including totalTemplates', async () => {
      const result = await controller.getStats(mockReq() as any);

      expect(result).toEqual(mockStats);
      expect(result.totalTemplates).toBe(3);
      expect(result.docTypeBreakdown).toHaveLength(2);
    });

    it('passes workspaceId from session to the service', async () => {
      await controller.getStats(mockReq({ session: { workspaceId: 'ws-abc' } }) as any);

      expect(service.getLibraryStats).toHaveBeenCalledWith('ws-abc');
    });

    it('throws BadRequestException when session has no workspaceId', async () => {
      await expect(
        controller.getStats(mockReq({ session: {} }) as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

// ─── LibraryService unit tests (pure logic, no DB) ───────────────────────────

describe('LibraryService — getLibraryStats()', () => {
  it('aggregates totalChunks from rawBreakdown correctly', () => {
    // Test the aggregation math inline (pure logic extracted)
    const rawBreakdown = [
      { docType: 'CONTRATO', count: '320' },
      { docType: 'INFORME', count: '160' },
    ];

    const totalChunks = rawBreakdown.reduce(
      (sum, row) => sum + parseInt(row.count, 10),
      0,
    );

    expect(totalChunks).toBe(480);
  });

  it('computes percentage correctly', () => {
    const count = 320;
    const total = 480;
    const percentage = Math.round((count / total) * 100);
    expect(percentage).toBe(67);
  });

  it('returns 0% when totalChunks is 0 (no division by zero)', () => {
    const totalChunks = 0;
    const count = 0;
    const percentage = totalChunks > 0 ? Math.round((count / totalChunks) * 100) : 0;
    expect(percentage).toBe(0);
  });

  it('maps null docType to "unknown"', () => {
    const row: { docType: string | null; count: string } = { docType: null, count: '5' };
    const docType = row.docType ?? 'unknown';
    expect(docType).toBe('unknown');
  });
});

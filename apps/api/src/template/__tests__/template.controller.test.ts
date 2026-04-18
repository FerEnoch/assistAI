import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TemplateController } from '../template.controller';
import { TemplateService } from '../template.service';
import type { Request } from 'express';

function mockRequest(workspaceId: string): Request {
  return {
    session: { workspaceId },
  } as unknown as Request;
}

describe('TemplateController', () => {
  let controller: TemplateController;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    service = {
      findAll: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue({ id: 'tpl-1' }),
      create: vi.fn().mockResolvedValue({ id: 'tpl-1', name: 'Test' }),
      update: vi.fn().mockResolvedValue({ id: 'tpl-1', name: 'Updated' }),
      remove: vi.fn().mockResolvedValue(undefined),
      getTemplateDocuments: vi.fn().mockResolvedValue([]),
      addDocumentToTemplate: vi.fn().mockResolvedValue(undefined),
      removeDocumentFromTemplate: vi.fn().mockResolvedValue(undefined),
    };

    controller = new TemplateController(service as unknown as TemplateService);
  });

  it('findAll delegates to service with workspaceId', async () => {
    await controller.findAll(mockRequest('ws-1'));
    expect(service.findAll).toHaveBeenCalledWith('ws-1');
  });

  it('findOne delegates to service', async () => {
    await controller.findOne('tpl-1', mockRequest('ws-1'));
    expect(service.findOne).toHaveBeenCalledWith('tpl-1', 'ws-1');
  });

  it('create delegates to service', async () => {
    const dto = { name: 'Test', sections: [] };
    await controller.create(dto as never, mockRequest('ws-1'));
    expect(service.create).toHaveBeenCalledWith('ws-1', dto);
  });

  it('remove delegates to service', async () => {
    await controller.remove('tpl-1', mockRequest('ws-1'));
    expect(service.remove).toHaveBeenCalledWith('tpl-1', 'ws-1');
  });

  /* ─── FIX 7: GET /templates/:id/documents — 403 cross-workspace ─── */

  it('GET /templates/:id/documents returns 403 when template belongs to different workspace', async () => {
    service.getTemplateDocuments.mockRejectedValueOnce(
      new ForbiddenException('Template does not belong to this workspace'),
    );

    await expect(controller.getDocuments('tpl-other', mockRequest('ws-1'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.getTemplateDocuments).toHaveBeenCalledWith('tpl-other', 'ws-1');
  });

  /* ─── FIX 8: POST /templates/:id/documents — workspace validation ─── */

  it('POST /templates/:id/documents returns 403 when documentId is from another workspace', async () => {
    service.addDocumentToTemplate.mockRejectedValueOnce(
      new ForbiddenException('Document does not belong to this workspace'),
    );

    await expect(
      controller.addDocument('tpl-1', { documentId: 'doc-other' } as never, mockRequest('ws-1')),
    ).rejects.toThrow(ForbiddenException);
    expect(service.addDocumentToTemplate).toHaveBeenCalledWith('tpl-1', 'doc-other', 'ws-1');
  });

  /* ─── FIX 9: DELETE /templates/:id/documents/:docId — 204 and doc not deleted ─── */

  it('DELETE /templates/:id/documents/:docId returns void (204) and does not delete the document entity', async () => {
    // The service.removeDocumentFromTemplate only deletes the association row,
    // not the document itself. We verify the correct method is called.
    const result = await controller.removeDocument('tpl-1', 'doc-1', mockRequest('ws-1'));

    expect(result).toBeUndefined(); // 204 — no body
    expect(service.removeDocumentFromTemplate).toHaveBeenCalledWith('tpl-1', 'doc-1', 'ws-1');
    // Ensure no document deletion methods were called (service mock has no 'removeDocument' method)
    expect(service.remove).not.toHaveBeenCalled();
  });
});

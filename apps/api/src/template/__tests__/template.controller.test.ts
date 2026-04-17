import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});

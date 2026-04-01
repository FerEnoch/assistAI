import { describe, it, expect, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { HealthController } from '../health.controller';

describe('HealthController (A-111)', () => {
  it('should return ok status when DB is healthy', async () => {
    const mockDataSource = {
      query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DataSource;

    const controller = new HealthController(mockDataSource);
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThan(0);
    expect(result.dependencies.postgres.status).toBe('ok');
    expect(result.dependencies.postgres.latencyMs).toBeDefined();
  });

  it('should return degraded status when DB is down', async () => {
    const mockDataSource = {
      query: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as DataSource;

    const controller = new HealthController(mockDataSource);
    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.dependencies.postgres.status).toBe('error');
  });
});

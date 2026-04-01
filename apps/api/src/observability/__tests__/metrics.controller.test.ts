import { describe, it, expect, vi } from 'vitest';

// Mock prom-client's Registry before importing the controller
vi.mock('@assistai/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@assistai/shared');
  return {
    ...actual,
    metricsRegistry: {
      metrics: vi.fn().mockResolvedValue(
        '# HELP assistai_http_requests_total Total HTTP requests\n' +
        '# TYPE assistai_http_requests_total counter\n' +
        'assistai_http_requests_total{method="GET",route="/health",status_code="200"} 42\n',
      ),
    },
  };
});

import { MetricsController } from '../metrics.controller';

describe('MetricsController (A-101)', () => {
  it('should return Prometheus metrics text', async () => {
    const controller = new MetricsController();
    const result = await controller.getMetrics();

    expect(result).toContain('assistai_http_requests_total');
    expect(result).toContain('# HELP');
    expect(result).toContain('# TYPE');
  });
});

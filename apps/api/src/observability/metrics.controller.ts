import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { metricsRegistry } from '@assistai/shared';

/**
 * Prometheus metrics endpoint (A-101).
 *
 * Exposes all registered metrics at GET /metrics for Prometheus scraping.
 * Skips rate limiting since this is infrastructure, not user-facing.
 */
@Controller('metrics')
@SkipThrottle()
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return metricsRegistry.metrics();
  }
}

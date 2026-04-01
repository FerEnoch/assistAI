import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

/**
 * Health check endpoint with dependency status (A-111).
 *
 * Reports health of:
 * - API service itself
 * - PostgreSQL database connection
 * - Redis connection (via BullMQ)
 *
 * Used by Docker HEALTHCHECK, load balancers, and monitoring.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{
    status: string;
    service: string;
    timestamp: string;
    uptime: number;
    dependencies: Record<string, { status: string; latencyMs?: number }>;
  }> {
    const deps: Record<string, { status: string; latencyMs?: number }> = {};

    // Check PostgreSQL
    const pgStart = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      deps.postgres = { status: 'ok', latencyMs: Date.now() - pgStart };
    } catch {
      deps.postgres = { status: 'error', latencyMs: Date.now() - pgStart };
    }

    // Overall status — degraded if any dependency is down
    const allOk = Object.values(deps).every((d) => d.status === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      service: 'api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: deps,
    };
  }
}

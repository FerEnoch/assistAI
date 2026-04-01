import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { REDACTED_PATHS } from '@assistai/shared';
import { MetricsController } from './metrics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Observability module — structured logging, metrics, analytics (A-100 to A-103).
 *
 * Provides:
 * - Pino structured logging via nestjs-pino (JSON in prod, pretty in dev)
 * - Secret redaction on all log output (A-093)
 * - Prometheus metrics endpoint at GET /metrics (A-101)
 * - Product analytics event service (A-103)
 * - Request/workspace ID propagation in log context
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [...REDACTED_PATHS],
          censor: '[REDACTED]',
        },
        // Generate request ID for correlation
        genReqId: (req) => {
          return (
            (req.headers['x-request-id'] as string) ??
            `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
          );
        },
        // Custom serializers — add workspaceId/userId from session
        serializers: {
          req(req: Record<string, unknown>) {
            const raw = req.raw as Record<string, unknown> | undefined;
            const session = (raw as Record<string, unknown> | undefined)?.session as
              | Record<string, unknown>
              | undefined;
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              workspaceId: session?.workspaceId ?? undefined,
              userId: session?.userId ?? undefined,
            };
          },
        },
        // Auto-log for all requests
        autoLogging: {
          ignore: (req) => {
            const url = req.url ?? '';
            // Don't log health checks or metrics scrapes
            return url === '/health' || url === '/metrics';
          },
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class ObservabilityModule {}

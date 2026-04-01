export { createLogger, REDACTED_PATHS, OBSERVABILITY_CONFIG } from './logger';
export type { CreateLoggerOptions } from './logger';

export {
  metricsRegistry,
  metrics,
  httpRequestDuration,
  httpRequestTotal,
  completionLatency,
  completionTotal,
  retrievalLatency,
  retrievalHitCount,
  queueDepth,
  jobDuration,
  activeConnections,
  providerLatency,
  providerErrors,
} from './metrics';

export { initTracing, createSpanContext } from './tracing';
export type { TracingConfig } from './tracing';

export { createAnalyticsEvent, BETA_KPIS } from './analytics';
export type { AnalyticsEvent, AnalyticsEventName } from './analytics';

export { KPI_DASHBOARD } from './dashboard';
export type { DashboardPanel } from './dashboard';

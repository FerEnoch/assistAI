import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics registry and metric definitions (A-101).
 *
 * Provides:
 * - Completion latency histogram (p50, p95, p99)
 * - Queue depth gauge (BullMQ waiting/active)
 * - Retrieval latency histogram
 * - Request counter by endpoint and status
 * - Active connections gauge
 *
 * Usage: import { metrics, metricsRegistry } from '@assistai/shared';
 * Expose via GET /metrics endpoint using metricsRegistry.metrics().
 */

export const metricsRegistry = new Registry();

// Collect Node.js default metrics (CPU, memory, event loop, GC)
collectDefaultMetrics({ register: metricsRegistry });

// ── Request metrics ──

export const httpRequestDuration = new Histogram({
  name: 'assistai_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestTotal = new Counter({
  name: 'assistai_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

// ── Completion metrics ──

export const completionLatency = new Histogram({
  name: 'assistai_completion_latency_seconds',
  help: 'End-to-end completion pipeline latency in seconds',
  labelNames: ['provider_type', 'outcome'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const completionTotal = new Counter({
  name: 'assistai_completions_total',
  help: 'Total completions requested',
  labelNames: ['provider_type', 'outcome', 'is_grounded'] as const,
  registers: [metricsRegistry],
});

// ── Retrieval metrics ──

export const retrievalLatency = new Histogram({
  name: 'assistai_retrieval_latency_seconds',
  help: 'Vector retrieval latency in seconds',
  labelNames: ['workspace_id'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const retrievalHitCount = new Histogram({
  name: 'assistai_retrieval_hits',
  help: 'Number of retrieval hits per query',
  buckets: [0, 1, 2, 3, 4, 5],
  registers: [metricsRegistry],
});

// ── Queue metrics (BullMQ) ──

export const queueDepth = new Gauge({
  name: 'assistai_queue_depth',
  help: 'Current queue depth (waiting + active jobs)',
  labelNames: ['queue_name', 'state'] as const,
  registers: [metricsRegistry],
});

export const jobDuration = new Histogram({
  name: 'assistai_job_duration_seconds',
  help: 'BullMQ job processing duration in seconds',
  labelNames: ['queue_name', 'job_name', 'outcome'] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
});

// ── Connection metrics ──

export const activeConnections = new Gauge({
  name: 'assistai_active_connections',
  help: 'Active SSE/WebSocket connections',
  labelNames: ['type'] as const,
  registers: [metricsRegistry],
});

// ── Provider metrics ──

export const providerLatency = new Histogram({
  name: 'assistai_provider_latency_seconds',
  help: 'LLM provider response latency in seconds',
  labelNames: ['provider_type', 'model'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const providerErrors = new Counter({
  name: 'assistai_provider_errors_total',
  help: 'Total provider errors by type',
  labelNames: ['provider_type', 'error_type'] as const,
  registers: [metricsRegistry],
});

/**
 * Convenience object grouping all metrics.
 */
export const metrics = {
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
} as const;

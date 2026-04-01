/**
 * OpenTelemetry tracing bootstrap (A-102).
 *
 * Lightweight tracing setup that initializes OTLP exporter when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set. Falls back to no-op if not configured.
 *
 * NOTE: In MVP beta, we ship the configuration interface but do NOT add
 * @opentelemetry/* as hard dependencies. The actual OTLP SDK packages
 * are optional — this module provides the bootstrap contract and config.
 *
 * When ready to enable tracing in production:
 * 1. Install @opentelemetry/sdk-node, @opentelemetry/exporter-trace-otlp-http
 * 2. Call initTracing() in main.ts before NestFactory.create()
 */

export interface TracingConfig {
  /** Service name (e.g. 'assistai-api', 'assistai-worker') */
  serviceName: string;
  /** OTLP endpoint URL — if empty, tracing is disabled */
  otlpEndpoint?: string;
  /** Sample rate: 0.0 to 1.0 (default: 0.1 in production, 1.0 in dev) */
  sampleRate?: number;
  /** Environment name */
  environment?: string;
}

/**
 * Initialize OpenTelemetry tracing.
 *
 * This is a forward-compatible bootstrap that logs tracing configuration
 * and provides the contract for when OTLP SDK is added.
 *
 * @returns true if tracing was configured, false if skipped
 */
export function initTracing(config: TracingConfig): boolean {
  const endpoint = config.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) {
    // Tracing not configured — this is fine for MVP beta
    return false;
  }

  const sampleRate =
    config.sampleRate ??
    (process.env.NODE_ENV === 'production' ? 0.1 : 1.0);

  // Log tracing configuration (will be picked up by structured logger)
  console.log(
    JSON.stringify({
      msg: 'OpenTelemetry tracing configured',
      service: config.serviceName,
      otlpEndpoint: endpoint,
      sampleRate,
      environment: config.environment ?? process.env.NODE_ENV ?? 'development',
      note: 'Install @opentelemetry/sdk-node to activate trace export',
    }),
  );

  return true;
}

/**
 * Create a span context object for manual instrumentation.
 *
 * Usage in services:
 * ```ts
 * const span = createSpanContext('completion.pipeline', { workspaceId });
 * // ... do work ...
 * span.end({ latencyMs, outcome });
 * ```
 */
export function createSpanContext(
  operationName: string,
  attributes: Record<string, string | number | boolean> = {},
): {
  operationName: string;
  attributes: Record<string, string | number | boolean>;
  startTime: number;
  end: (extra?: Record<string, string | number | boolean>) => {
    operationName: string;
    attributes: Record<string, string | number | boolean>;
    durationMs: number;
  };
} {
  const startTime = Date.now();

  return {
    operationName,
    attributes,
    startTime,
    end(extra = {}) {
      return {
        operationName,
        attributes: { ...attributes, ...extra },
        durationMs: Date.now() - startTime,
      };
    },
  };
}

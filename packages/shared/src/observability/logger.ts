import pino from 'pino';

/**
 * Sensitive field paths that MUST be redacted in all log output (A-093, A-100).
 *
 * Follows pino's redaction path syntax (dot-notation, wildcards).
 * Secrets, tokens, passwords, and PII are replaced with '[REDACTED]'.
 */
export const REDACTED_PATHS = [
  // Auth tokens & secrets
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'password',
  'secret',
  'token',
  'refreshToken',
  'accessToken',
  'apiKey',
  'googleRefreshTokenEnc',
  'credentialEncryptionKey',
  'sessionSecret',
  'csrfSecret',
  'jwtSecret',
  // Nested variations
  '*.password',
  '*.secret',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.apiKey',
  '*.googleRefreshTokenEnc',
] as const;

export interface CreateLoggerOptions {
  /** Service name: 'api' | 'worker' */
  service: string;
  /** Log level override (defaults to LOG_LEVEL env or 'info') */
  level?: string;
  /** Whether to use pino-pretty for local dev (defaults to NODE_ENV !== 'production') */
  pretty?: boolean;
}

/**
 * Create a structured pino logger with request/workspace context and secret redaction.
 *
 * Features:
 * - JSON output in production, pino-pretty in development
 * - Automatic redaction of sensitive fields (A-093)
 * - Base fields: service, env, pid
 * - Child loggers add requestId, workspaceId, userId
 */
export function createLogger(options: CreateLoggerOptions): pino.Logger {
  const isProd = process.env.NODE_ENV === 'production';
  const level = options.level ?? process.env.LOG_LEVEL ?? 'info';
  const usePretty = options.pretty ?? !isProd;

  return pino({
    level,
    redact: {
      paths: [...REDACTED_PATHS],
      censor: '[REDACTED]',
    },
    base: {
      service: options.service,
      env: process.env.NODE_ENV ?? 'development',
      pid: process.pid,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Serializers for request/response logging
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
    ...(usePretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  });
}

/**
 * Observability configuration constants.
 */
export const OBSERVABILITY_CONFIG = {
  /** Default log level */
  defaultLogLevel: 'info',

  /** Metrics scrape endpoint path */
  metricsPath: '/metrics',

  /** Health check endpoint path */
  healthPath: '/health',

  /** Tracing sample rate (1.0 = 100%, 0.1 = 10%) */
  traceSampleRate: 0.1,

  /** Tracing service name prefix */
  serviceNamePrefix: 'assistai',
} as const;

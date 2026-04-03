import { z } from 'zod';

/**
 * Common environment variables shared across all services.
 */
const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

/**
 * API service environment variables.
 */
export const apiEnvSchema = baseEnvSchema.extend({
  PORT_API: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection string' }),

  // Auth
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  MAGIC_LINK_URL: z.string().url({ message: 'MAGIC_LINK_URL must be a valid URL (e.g. http://localhost:5173/auth/verify)' }),

  // Credential encryption
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'CREDENTIAL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url({ message: 'GOOGLE_REDIRECT_URI must be a valid URL' }),

  // External services
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for embeddings'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),

  // Frontend origin (for CORS + CSP in development)
  WEB_URL: z.string().url({ message: 'WEB_URL must be a valid URL (e.g. http://localhost:5173)' }).default('http://localhost:5173'),

  // Dev mode (optional)
  DEV_AUTH_BYPASS: z.enum(['true', 'false']).default('false'),

  // Observability (optional)
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

/**
 * Worker service environment variables.
 */
export const workerEnvSchema = baseEnvSchema.extend({
  PORT_WORKER: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection string' }),

  // Credential encryption (worker needs to decrypt tokens for Drive access)
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'CREDENTIAL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),

  // Google OAuth (worker needs client ID/secret to refresh access tokens for Drive)
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),

  // External services needed by worker
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for embeddings'),

  // Observability (optional)
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

/**
 * Frontend environment variables (Vite-compatible: VITE_ prefix).
 */
export const webEnvSchema = z.object({
  VITE_API_URL: z.string().url({ message: 'VITE_API_URL must be a valid URL' }),
  VITE_APP_NAME: z.string().default('AssistAI'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

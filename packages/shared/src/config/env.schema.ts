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
  SESSION_SECRET: z.string().min(32).default('dev-session-secret-at-least-32-chars-long'),
  CSRF_SECRET: z.string().min(32).default('dev-csrf-secret-at-least-32-chars-long'),
  JWT_SECRET: z.string().min(32).default('dev-jwt-secret-at-least-32-chars-long'),
  MAGIC_LINK_URL: z.string().url().default('http://localhost:5173/auth/verify'),

  // Credential encryption
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .default('b90e69894137471b490f5972e0ee0fb14612fc3ca8062446eae0bff092eed21a'),

  // Google OAuth (optional for dev mode without Drive)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // External services (optional - FreeTierProvider will handle missing keys gracefully)
  OPENROUTER_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Frontend origin (for CORS + CSP in development)
  WEB_URL: z.string().url().default('http://localhost:5173'),

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
    .regex(/^[0-9a-fA-F]{64}$/)
    .default('b90e69894137471b490f5972e0ee0fb14612fc3ca8062446eae0bff092eed21a'),

  // Google OAuth (worker needs client ID/secret to refresh access tokens for Drive)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // External services needed by worker
  OPENAI_API_KEY: z.string().optional(),

  // Observability (optional)
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

/**
 * Frontend environment variables (Vite-compatible: VITE_ prefix).
 */
export const webEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3000'),
  VITE_APP_NAME: z.string().default('AssistAI'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

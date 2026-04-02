import { describe, it, expect } from 'vitest';
import { validateEnv } from '../validate-env';
import { apiEnvSchema, workerEnvSchema, webEnvSchema } from '../env.schema';

const validApiEnv = {
  NODE_ENV: 'development',
  PORT_API: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/assistai',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'a'.repeat(32),
  CSRF_SECRET: 'b'.repeat(32),
  JWT_SECRET: 'c'.repeat(32),
  MAGIC_LINK_URL: 'http://localhost:5173/auth/verify',
  CREDENTIAL_ENCRYPTION_KEY: 'a'.repeat(64),
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/sources/drive/callback',
  OPENROUTER_API_KEY: 'openrouter-key',
  OPENAI_API_KEY: 'openai-key',
  RESEND_API_KEY: 'resend-key',
  WEB_URL: 'http://localhost:5173',
};

const validWorkerEnv = {
  NODE_ENV: 'development',
  PORT_WORKER: '3001',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/assistai',
  REDIS_URL: 'redis://localhost:6379',
  CREDENTIAL_ENCRYPTION_KEY: 'a'.repeat(64),
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  OPENAI_API_KEY: 'openai-key',
};

describe('validateEnv', () => {
  describe('API env schema', () => {
    it('should validate a correct API env', () => {
      const result = validateEnv(apiEnvSchema, validApiEnv, {
        serviceName: 'api',
        exitOnFailure: false,
      });

      expect(result.PORT_API).toBe(3000);
      expect(result.DATABASE_URL).toBe(validApiEnv.DATABASE_URL);
      expect(result.NODE_ENV).toBe('development');
    });

    it('should fail fast when DATABASE_URL is missing', () => {
      const env = { ...validApiEnv, DATABASE_URL: undefined };

      expect(() =>
        validateEnv(apiEnvSchema, env as Record<string, string | undefined>, {
          serviceName: 'api',
          exitOnFailure: false,
        }),
      ).toThrow('Invalid environment configuration for api');
    });

    it('should fail fast when CREDENTIAL_ENCRYPTION_KEY is wrong length', () => {
      const env = { ...validApiEnv, CREDENTIAL_ENCRYPTION_KEY: 'tooshort' };

      expect(() =>
        validateEnv(apiEnvSchema, env, {
          serviceName: 'api',
          exitOnFailure: false,
        }),
      ).toThrow('Invalid environment configuration for api');
    });

    it('should fail fast when CREDENTIAL_ENCRYPTION_KEY is not hex', () => {
      const env = { ...validApiEnv, CREDENTIAL_ENCRYPTION_KEY: 'g'.repeat(64) };

      expect(() =>
        validateEnv(apiEnvSchema, env, {
          serviceName: 'api',
          exitOnFailure: false,
        }),
      ).toThrow('Invalid environment configuration for api');
    });

    it('should fail fast when SESSION_SECRET is too short', () => {
      const env = { ...validApiEnv, SESSION_SECRET: 'short' };

      expect(() =>
        validateEnv(apiEnvSchema, env, {
          serviceName: 'api',
          exitOnFailure: false,
        }),
      ).toThrow('Invalid environment configuration for api');
    });

    it('should accept optional SENTRY_DSN', () => {
      const env = { ...validApiEnv, SENTRY_DSN: 'https://sentry.io/123' };
      const result = validateEnv(apiEnvSchema, env, {
        serviceName: 'api',
        exitOnFailure: false,
      });

      expect(result.SENTRY_DSN).toBe('https://sentry.io/123');
    });

    it('should use defaults for PORT_API when not provided', () => {
      const { PORT_API: _port, ...envWithoutPort } = validApiEnv;
      const result = validateEnv(apiEnvSchema, envWithoutPort, {
        serviceName: 'api',
        exitOnFailure: false,
      });

      expect(result.PORT_API).toBe(3000);
    });
  });

  describe('Worker env schema', () => {
    it('should validate a correct worker env', () => {
      const result = validateEnv(workerEnvSchema, validWorkerEnv, {
        serviceName: 'worker',
        exitOnFailure: false,
      });

      expect(result.PORT_WORKER).toBe(3001);
      expect(result.DATABASE_URL).toBe(validWorkerEnv.DATABASE_URL);
    });

    it('should fail fast when REDIS_URL is missing', () => {
      const env = { ...validWorkerEnv, REDIS_URL: undefined };

      expect(() =>
        validateEnv(workerEnvSchema, env as Record<string, string | undefined>, {
          serviceName: 'worker',
          exitOnFailure: false,
        }),
      ).toThrow('Invalid environment configuration for worker');
    });
  });

  describe('Web env schema', () => {
    it('should validate a correct web env', () => {
      const result = validateEnv(webEnvSchema, { VITE_API_URL: 'http://localhost:3000' }, {
        serviceName: 'web',
        exitOnFailure: false,
      });

      expect(result.VITE_API_URL).toBe('http://localhost:3000');
      expect(result.VITE_APP_NAME).toBe('AssistAI');
    });

    it('should fail fast when VITE_API_URL is invalid', () => {
      expect(() =>
        validateEnv(webEnvSchema, { VITE_API_URL: 'not-a-url' }, {
          serviceName: 'web',
          exitOnFailure: false,
        }),
      ).toThrow('Invalid environment configuration for web');
    });
  });
});

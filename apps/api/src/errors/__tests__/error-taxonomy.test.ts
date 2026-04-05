import { describe, it, expect } from 'vitest';
import { mapToErrorCode, getErrorMessage } from '../error-taxonomy';
import { ErrorCode } from '../error-codes';
import { ERROR_MESSAGES } from '../error-messages';

describe('mapToErrorCode', () => {
  // ── INFRA paths ──
  describe('INFRA codes', () => {
    it('maps ECONNREFUSED to INFRA_CONNECTION_REFUSED', () => {
      expect(mapToErrorCode('ECONNREFUSED: connect to 127.0.0.1:6379 failed'))
        .toBe(ErrorCode.INFRA_CONNECTION_REFUSED);
    });

    it('maps "connection refused" (lowercase) to INFRA_CONNECTION_REFUSED', () => {
      expect(mapToErrorCode('connection refused at port 5432'))
        .toBe(ErrorCode.INFRA_CONNECTION_REFUSED);
    });

    it('maps ETIMEDOUT to INFRA_TIMEOUT', () => {
      expect(mapToErrorCode('ETIMEDOUT: connection timed out'))
        .toBe(ErrorCode.INFRA_TIMEOUT);
    });

    it('maps "timeout" substring to INFRA_TIMEOUT', () => {
      expect(mapToErrorCode('request timeout after 30s'))
        .toBe(ErrorCode.INFRA_TIMEOUT);
    });

    it('maps "tiempo" substring to INFRA_TIMEOUT', () => {
      expect(mapToErrorCode('excedió el tiempo de espera'))
        .toBe(ErrorCode.INFRA_TIMEOUT);
    });

    it('maps ENOTFOUND to INFRA_NOT_FOUND', () => {
      expect(mapToErrorCode('ENOTFOUND: getaddrinfo failed'))
        .toBe(ErrorCode.INFRA_NOT_FOUND);
    });

    it('maps "ERR syntax error" to INFRA_REDIS_CONFIG', () => {
      expect(mapToErrorCode('ERR syntax error in redis command'))
        .toBe(ErrorCode.INFRA_REDIS_CONFIG);
    });

    it('maps "redis" substring to INFRA_REDIS_CONFIG', () => {
      expect(mapToErrorCode('Redis connection pool exhausted'))
        .toBe(ErrorCode.INFRA_REDIS_CONFIG);
    });
  });

  // ── DB paths ──
  describe('DB codes', () => {
    it('maps "duplicate key" to DB_DUPLICATE_KEY', () => {
      expect(mapToErrorCode('duplicate key value violates unique constraint'))
        .toBe(ErrorCode.DB_DUPLICATE_KEY);
    });

    it('maps "null value" to DB_NULL_VALUE', () => {
      expect(mapToErrorCode('null value in column "email" violates not-null'))
        .toBe(ErrorCode.DB_NULL_VALUE);
    });

    it('maps "postgres" to DB_ERROR', () => {
      expect(mapToErrorCode('postgres query failed'))
        .toBe(ErrorCode.DB_ERROR);
    });

    it('maps "database" to DB_ERROR', () => {
      expect(mapToErrorCode('database connection lost'))
        .toBe(ErrorCode.DB_ERROR);
    });
  });

  // ── COMPLETION paths ──
  describe('COMPLETION codes', () => {
    it('maps "QUOTA_EXHAUSTED" prefix to COMPLETION_QUOTA_EXHAUSTED', () => {
      expect(mapToErrorCode('QUOTA_EXHAUSTED: daily limit reached'))
        .toBe(ErrorCode.COMPLETION_QUOTA_EXHAUSTED);
    });

    it('maps "quota" substring to COMPLETION_QUOTA_EXHAUSTED', () => {
      expect(mapToErrorCode('your quota has been exceeded'))
        .toBe(ErrorCode.COMPLETION_QUOTA_EXHAUSTED);
    });

    it('maps "limit" substring to COMPLETION_QUOTA_EXHAUSTED', () => {
      expect(mapToErrorCode('request limit exceeded'))
        .toBe(ErrorCode.COMPLETION_QUOTA_EXHAUSTED);
    });

    it('maps "rate_limit" to COMPLETION_RATE_LIMITED', () => {
      expect(mapToErrorCode('RATE_LIMIT: too many requests'))
        .toBe(ErrorCode.COMPLETION_RATE_LIMITED);
    });

    it('maps "429" to COMPLETION_RATE_LIMITED', () => {
      expect(mapToErrorCode('HTTP 429 Too Many Requests'))
        .toBe(ErrorCode.COMPLETION_RATE_LIMITED);
    });

    it('maps "all_providers_failed" to COMPLETION_ALL_FAILED', () => {
      expect(mapToErrorCode('ALL_PROVIDERS_FAILED: none responded'))
        .toBe(ErrorCode.COMPLETION_ALL_FAILED);
    });

    it('maps "no_provider_configured" to COMPLETION_NO_PROVIDER', () => {
      expect(mapToErrorCode('NO_PROVIDER_CONFIGURED for workspace'))
        .toBe(ErrorCode.COMPLETION_NO_PROVIDER);
    });

    it('maps "no hay proveedores" to COMPLETION_NO_PROVIDER', () => {
      expect(mapToErrorCode('no hay proveedores disponibles'))
        .toBe(ErrorCode.COMPLETION_NO_PROVIDER);
    });

    it('maps "providers_unavailable" to COMPLETION_PROVIDERS_UNAVAILABLE', () => {
      expect(mapToErrorCode('PROVIDERS_UNAVAILABLE: all down'))
        .toBe(ErrorCode.COMPLETION_PROVIDERS_UNAVAILABLE);
    });

    it('maps "bad_request" to COMPLETION_BAD_REQUEST', () => {
      expect(mapToErrorCode('BAD_REQUEST: missing field'))
        .toBe(ErrorCode.COMPLETION_BAD_REQUEST);
    });

    it('maps "invalid_request" to COMPLETION_BAD_REQUEST', () => {
      expect(mapToErrorCode('INVALID_REQUEST: unsupported model'))
        .toBe(ErrorCode.COMPLETION_BAD_REQUEST);
    });
  });

  // ── AUTH paths ──
  describe('AUTH codes', () => {
    it('maps "auth_error" to AUTH_PROVIDER_ERROR', () => {
      expect(mapToErrorCode('AUTH_ERROR: invalid api_key provided'))
        .toBe(ErrorCode.AUTH_PROVIDER_ERROR);
    });

    it('maps "api_key" to AUTH_PROVIDER_ERROR', () => {
      expect(mapToErrorCode('Incorrect api_key for model'))
        .toBe(ErrorCode.AUTH_PROVIDER_ERROR);
    });

    it('maps "authentication" to AUTH_PROVIDER_ERROR', () => {
      expect(mapToErrorCode('authentication failed at provider'))
        .toBe(ErrorCode.AUTH_PROVIDER_ERROR);
    });

    it('maps "invalid credentials" to AUTH_INVALID_CREDENTIALS', () => {
      expect(mapToErrorCode('invalid credentials for user@test.com'))
        .toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    });

    it('maps "unauthorized" to AUTH_UNAUTHORIZED', () => {
      expect(mapToErrorCode('Unauthorized access to resource'))
        .toBe(ErrorCode.AUTH_UNAUTHORIZED);
    });

    it('maps "forbidden" to AUTH_FORBIDDEN', () => {
      expect(mapToErrorCode('Forbidden: insufficient permissions'))
        .toBe(ErrorCode.AUTH_FORBIDDEN);
    });
  });

  // ── Fallback ──
  describe('fallback', () => {
    it('returns GENERIC_ERROR for unknown error messages', () => {
      expect(mapToErrorCode('something totally unexpected happened'))
        .toBe(ErrorCode.GENERIC_ERROR);
    });

    it('returns GENERIC_ERROR for empty string', () => {
      expect(mapToErrorCode('')).toBe(ErrorCode.GENERIC_ERROR);
    });
  });

  // ── REQ-6 regression: "invalid request" must NOT match AUTH_PROVIDER_ERROR ──
  describe('REQ-6 regression', () => {
    it('"invalid request: missing field" returns COMPLETION_BAD_REQUEST, NOT AUTH_PROVIDER_ERROR', () => {
      const result = mapToErrorCode('invalid request: missing required field');
      expect(result).toBe(ErrorCode.COMPLETION_BAD_REQUEST);
      expect(result).not.toBe(ErrorCode.AUTH_PROVIDER_ERROR);
    });

    it('"invalid" alone does NOT trigger AUTH_PROVIDER_ERROR', () => {
      // "invalid" by itself is too broad. With the new taxonomy,
      // it should fall through to GENERIC_ERROR since no structured prefix matches.
      const result = mapToErrorCode('invalid');
      expect(result).not.toBe(ErrorCode.AUTH_PROVIDER_ERROR);
    });
  });
});

describe('getErrorMessage', () => {
  it('returns a non-empty string for every ErrorCode', () => {
    for (const code of Object.values(ErrorCode)) {
      const message = getErrorMessage(code);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('returns the exact Spanish message for INFRA_TIMEOUT (Scenario 5)', () => {
    expect(getErrorMessage(ErrorCode.INFRA_TIMEOUT))
      .toBe('La conexión tardó demasiado. Verifica tu conexión a internet.');
  });

  it('returns the GENERIC_ERROR message for an unknown code cast as ErrorCode', () => {
    // Force an unknown value to test the fallback ?? operator
    const unknownCode = 'TOTALLY_UNKNOWN' as ErrorCode;
    expect(getErrorMessage(unknownCode))
      .toBe(ERROR_MESSAGES[ErrorCode.GENERIC_ERROR]);
  });

  it('returns the exact message from ERROR_MESSAGES for each code', () => {
    // Triangulation: verify a few specific codes match their map entry
    expect(getErrorMessage(ErrorCode.COMPLETION_QUOTA_EXHAUSTED))
      .toBe(ERROR_MESSAGES[ErrorCode.COMPLETION_QUOTA_EXHAUSTED]);
    expect(getErrorMessage(ErrorCode.AUTH_PROVIDER_ERROR))
      .toBe(ERROR_MESSAGES[ErrorCode.AUTH_PROVIDER_ERROR]);
    expect(getErrorMessage(ErrorCode.DB_DUPLICATE_KEY))
      .toBe(ERROR_MESSAGES[ErrorCode.DB_DUPLICATE_KEY]);
  });
});

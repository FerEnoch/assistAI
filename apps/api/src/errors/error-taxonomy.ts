import { ErrorCode } from './error-codes';
import { ERROR_MESSAGES } from './error-messages';

/**
 * Maps a raw error message string to a deterministic ErrorCode.
 *
 * Priority order:
 * 1. Completion — structured code prefixes (from FreeTierProvider)
 * 2. Auth — specific patterns only (NO broad 'invalid')
 * 3. Infrastructure — connection, timeout, DNS, redis
 * 4. Database — duplicate key, null value, generic DB
 * 5. Fallback — GENERIC_ERROR
 */
export function mapToErrorCode(msg: string): ErrorCode {
  const m = msg.toLowerCase();

  // ── Completion — structured code prefixes ──
  // rate_limit MUST be checked before the broad 'limit' catch-all
  if (m.includes('rate_limit') || m.includes('429')) {
    return ErrorCode.COMPLETION_RATE_LIMITED;
  }
  if (m.includes('quota_exhausted') || m.includes('quota') || m.includes('limit')) {
    return ErrorCode.COMPLETION_QUOTA_EXHAUSTED;
  }
  if (m.includes('all_providers_failed')) {
    return ErrorCode.COMPLETION_ALL_FAILED;
  }
  if (m.includes('no_provider_configured') || m.includes('no hay proveedores')) {
    return ErrorCode.COMPLETION_NO_PROVIDER;
  }
  if (m.includes('providers_unavailable')) {
    return ErrorCode.COMPLETION_PROVIDERS_UNAVAILABLE;
  }
  // 'invalid request' (with space) catches human-readable variants (REQ-6)
  if (m.includes('bad_request') || m.includes('invalid_request') || m.includes('invalid request')) {
    return ErrorCode.COMPLETION_BAD_REQUEST;
  }

  // ── Auth — specific patterns ONLY (no broad 'invalid') ──
  if (m.includes('auth_error') || m.includes('api_key') || m.includes('authentication')) {
    return ErrorCode.AUTH_PROVIDER_ERROR;
  }
  if (m.includes('invalid credentials')) {
    return ErrorCode.AUTH_INVALID_CREDENTIALS;
  }
  if (m.includes('unauthorized')) {
    return ErrorCode.AUTH_UNAUTHORIZED;
  }
  if (m.includes('forbidden')) {
    return ErrorCode.AUTH_FORBIDDEN;
  }

  // ── Infrastructure ──
  if (m.includes('econnrefused') || m.includes('connection refused')) {
    return ErrorCode.INFRA_CONNECTION_REFUSED;
  }
  if (m.includes('etimedout') || m.includes('timeout') || m.includes('tiempo')) {
    return ErrorCode.INFRA_TIMEOUT;
  }
  if (m.includes('enotfound')) {
    return ErrorCode.INFRA_NOT_FOUND;
  }
  if (m.includes('err syntax error') || m.includes('redis')) {
    return ErrorCode.INFRA_REDIS_CONFIG;
  }

  // ── Database ──
  if (m.includes('duplicate key')) {
    return ErrorCode.DB_DUPLICATE_KEY;
  }
  if (m.includes('null value')) {
    return ErrorCode.DB_NULL_VALUE;
  }
  if (m.includes('database') || m.includes('postgres')) {
    return ErrorCode.DB_ERROR;
  }

  return ErrorCode.GENERIC_ERROR;
}

/**
 * Returns the user-facing Spanish message for an ErrorCode.
 */
export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES[ErrorCode.GENERIC_ERROR];
}

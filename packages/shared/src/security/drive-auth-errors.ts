/**
 * Shared Drive auth-failure classification.
 *
 * Distinguishes genuine OAuth/token failures (→ needs_reauth) from ordinary
 * Drive permission errors (403 on a single file) that should NOT downgrade
 * the entire source.
 *
 * Used by both discovery and parse processors, and by the API controller,
 * so the classification logic lives in one place.
 */

/** Signatures that indicate the *token itself* is broken (reauth required). */
const TOKEN_FAILURE_PATTERNS = [
  'invalid_grant',
  'token has been expired or revoked',
  'failed to refresh access token',
  'token has been revoked',
  'insufficient_scope',
  'access_denied',          // OAuth consent revoked
  'unauthorized_client',
] as const;

/**
 * Returns `true` when the error represents a genuine OAuth / token failure
 * that means the source's credentials are no longer usable and the user
 * must re-authenticate.
 *
 * Returns `false` for ordinary Drive permission errors (e.g. 403 on a
 * specific file the service account can't access) — those should be
 * handled at the document level, not the source level.
 */
export function isDriveAuthFailure(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const status =
    (err as any).code ??
    (err as any).status ??
    (err as any).response?.status;

  // 401 is always an auth failure (token rejected by Google)
  if (status === 401) return true;

  // For 403, check if the message matches a *token-level* failure.
  // A bare 403 (e.g. "The user does not have sufficient permissions for file X")
  // is NOT an auth failure — it's a per-resource ACL issue.
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  for (const pattern of TOKEN_FAILURE_PATTERNS) {
    if (msg.includes(pattern)) return true;
  }

  // Google API errors sometimes carry an `errors` array with reason codes
  const errors: any[] | undefined = (err as any).errors ?? (err as any).response?.data?.error?.errors;
  if (Array.isArray(errors)) {
    for (const e of errors) {
      const reason = String(e?.reason ?? '').toLowerCase();
      if (
        reason === 'autherror' ||
        reason === 'insufficientpermissions' ||
        reason === 'forbidden' // scope-level, not file-level
      ) {
        // Only count as auth failure if it's accompanied by a token pattern in the message
        // or is a 401. Pure 'forbidden' reason without token pattern → per-file ACL.
        if (status === 401) return true;
        for (const pattern of TOKEN_FAILURE_PATTERNS) {
          if (msg.includes(pattern)) return true;
        }
        if (reason === 'autherror' || reason === 'insufficientpermissions') return true;
      }
    }
  }

  return false;
}

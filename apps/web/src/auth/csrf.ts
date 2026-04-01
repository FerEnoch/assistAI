import envConfig from '../config';

/**
 * CSRF token cache.
 *
 * The token is fetched once from /auth/csrf-token and cached in memory.
 * It's refreshed on 403 responses (indicating an expired/invalid token).
 *
 * csrf-csrf uses double-submit cookie pattern — the server sets a cookie
 * and expects the same token in the x-csrf-token header.
 */
let cachedToken: string | null = null;

/**
 * Fetch a CSRF token from the server.
 * Caches the result in memory for subsequent requests.
 */
export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  try {
    const res = await fetch(`${envConfig.apiUrl}/auth/csrf-token`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch CSRF token: ${res.status}`);
    }

    const data = await res.json();
    cachedToken = data.token;
    return cachedToken!;
  } catch {
    return '';
  }
}

/**
 * Invalidate the cached CSRF token.
 * Call this when a 403 is received to force a refresh.
 */
export function invalidateCsrfToken(): void {
  cachedToken = null;
}

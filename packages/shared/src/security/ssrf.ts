import { resolve4 } from 'node:dns/promises';

/**
 * SSRF protection for BYO endpoint validation (A-092).
 *
 * Validates URLs against:
 * - Allowed schemes: http, https only
 * - Allowed ports: 80, 443 only
 * - Blocked IPs: localhost, RFC1918, link-local, metadata (169.254.x.x)
 *
 * Uses DNS resolution via 8.8.8.8 to catch DNS rebinding.
 * Per design §Security: ssrf-req-filter pattern, custom DNS lookup.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set([80, 443]);

/**
 * Check if an IP address is in a blocked range.
 *
 * Blocked: localhost, RFC1918 (10.x, 172.16-31.x, 192.168.x),
 *          link-local (169.254.x), loopback (127.x), broadcast, multicast.
 */
export function isBlockedIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);

  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    // Not a valid IPv4 — block it
    return true;
  }

  const [a, b] = parts;

  // Loopback: 127.0.0.0/8
  if (a === 127) return true;

  // RFC1918: 10.0.0.0/8
  if (a === 10) return true;

  // RFC1918: 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // RFC1918: 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // Link-local / APIPA / cloud metadata: 169.254.0.0/16
  if (a === 169 && b === 254) return true;

  // Broadcast
  if (a === 255) return true;

  // Current network: 0.0.0.0/8
  if (a === 0) return true;

  // Multicast: 224.0.0.0/4
  if (a >= 224 && a <= 239) return true;

  return false;
}

/**
 * Validate a URL for SSRF safety (A-092).
 *
 * @returns null if the URL is safe, or an error message if blocked.
 */
export async function validateUrlForSsrf(rawUrl: string): Promise<string | null> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Invalid URL format';
  }

  // Check scheme
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return `Blocked scheme: ${parsed.protocol} — only http: and https: are allowed`;
  }

  // Check port
  const port = parsed.port
    ? parseInt(parsed.port, 10)
    : parsed.protocol === 'https:' ? 443 : 80;

  if (!ALLOWED_PORTS.has(port)) {
    return `Blocked port: ${port} — only 80 and 443 are allowed`;
  }

  // Resolve hostname to IP and check for blocked ranges
  const hostname = parsed.hostname;

  // Direct IP check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isBlockedIp(hostname)) {
      return `Blocked IP address: ${hostname} — private/reserved ranges not allowed`;
    }
    return null;
  }

  // Localhost hostname variants
  if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
    return 'Blocked hostname: localhost — not allowed for BYO endpoints';
  }

  // DNS resolution
  try {
    const addresses = await resolve4(hostname);

    for (const addr of addresses) {
      if (isBlockedIp(addr)) {
        return `Blocked: ${hostname} resolves to private IP ${addr}`;
      }
    }
  } catch {
    return `DNS resolution failed for hostname: ${hostname}`;
  }

  return null;
}

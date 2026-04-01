import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import type { Request } from 'express';
import { RATE_LIMIT_CONFIG } from '@assistai/shared';

/**
 * Auth rate limit guard — 5 requests per 15 minutes per IP (A-095).
 *
 * Applied specifically to the magic-link endpoint.
 * Uses IP-based tracking (no user session at this point).
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Use IP for auth endpoints (no session yet)
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  protected getTrackers(_req: Request): Promise<Array<{ key: string; ttl: number; limit: number }>> {
    return Promise.resolve([
      {
        key: 'auth',
        ttl: RATE_LIMIT_CONFIG.auth.ttlSeconds * 1000,
        limit: RATE_LIMIT_CONFIG.auth.limit,
      },
    ]);
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: {
      ttl: number;
      limit: number;
      key: string;
      tracker: string;
      totalHits: number;
      timeToExpire: number;
      isBlocked: boolean;
      timeToBlockExpire: number;
    },
  ): Promise<void> {
    throw new ThrottlerException(
      'Demasiados intentos. Esperá unos minutos antes de intentar de nuevo.',
    );
  }
}

/**
 * Completion rate limit guard — 60 req/min + 1000/day per user (A-095).
 *
 * Applied to the completion streaming endpoint.
 * Uses user ID for tracking (requires authentication).
 */
@Injectable()
export class CompletionThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Use user ID for completion endpoints
    return req.session?.userId ?? req.ip ?? 'unknown';
  }

  protected getTrackers(_req: Request): Promise<Array<{ key: string; ttl: number; limit: number }>> {
    return Promise.resolve([
      {
        key: 'completion-min',
        ttl: RATE_LIMIT_CONFIG.completionsPerMinute.ttlSeconds * 1000,
        limit: RATE_LIMIT_CONFIG.completionsPerMinute.limit,
      },
      {
        key: 'completion-day',
        ttl: RATE_LIMIT_CONFIG.completionsPerDay.ttlSeconds * 1000,
        limit: RATE_LIMIT_CONFIG.completionsPerDay.limit,
      },
    ]);
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: {
      ttl: number;
      limit: number;
      key: string;
      tracker: string;
      totalHits: number;
      timeToExpire: number;
      isBlocked: boolean;
      timeToBlockExpire: number;
    },
  ): Promise<void> {
    throw new ThrottlerException(
      'Límite de solicitudes alcanzado. Intentá de nuevo en un momento.',
    );
  }
}

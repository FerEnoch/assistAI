import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RATE_LIMIT_CONFIG } from '@assistai/shared';

/**
 * Security module — rate limiting and SSRF protections (A-092, A-095).
 *
 * Rate limits per spec:
 * - Auth (magic-link): 5 req/15min per IP
 * - Completions: 60 req/min + 1000/day per user
 *
 * Uses @nestjs/throttler v6 with multiple throttler configs.
 * In production, use Redis store for distributed rate limiting.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: RATE_LIMIT_CONFIG.completionsPerMinute.ttlSeconds * 1000,
        limit: RATE_LIMIT_CONFIG.completionsPerMinute.limit,
      },
      {
        name: 'long',
        ttl: RATE_LIMIT_CONFIG.completionsPerDay.ttlSeconds * 1000,
        limit: RATE_LIMIT_CONFIG.completionsPerDay.limit,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class SecurityModule {}

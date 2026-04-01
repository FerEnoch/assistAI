import { describe, it, expect } from 'vitest';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SessionGuard } from '../guards/session.guard';
import { RecentAuthGuard } from '../guards/recent-auth.guard';

function createMockContext(sessionData: Record<string, unknown> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        session: sessionData,
      }),
    }),
  };
}

describe('SessionGuard', () => {
  const guard = new SessionGuard();

  it('should allow access when session has userId', () => {
    const ctx = createMockContext({ userId: 'u1' });
    expect(guard.canActivate(ctx as never)).toBe(true);
  });

  it('should throw UnauthorizedException when no userId in session', () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when no session at all', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ session: undefined }),
      }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
  });
});

describe('RecentAuthGuard', () => {
  const guard = new RecentAuthGuard();

  it('should allow access when authenticated within 15 minutes', () => {
    const ctx = createMockContext({
      userId: 'u1',
      authenticatedAt: Date.now() - 10 * 60 * 1000, // 10 min ago
    });
    expect(guard.canActivate(ctx as never)).toBe(true);
  });

  it('should throw ForbiddenException with RECENT_AUTH_REQUIRED when auth is stale (>15 min)', () => {
    const ctx = createMockContext({
      userId: 'u1',
      authenticatedAt: Date.now() - 16 * 60 * 1000, // 16 min ago
    });

    try {
      guard.canActivate(ctx as never);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse();
      expect(response).toMatchObject({
        code: 'RECENT_AUTH_REQUIRED',
        redirectTo: '/auth/reconfirm',
      });
    }
  });

  it('should throw when authenticatedAt is missing', () => {
    const ctx = createMockContext({ userId: 'u1' });

    try {
      guard.canActivate(ctx as never);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse();
      expect(response).toMatchObject({ code: 'RECENT_AUTH_REQUIRED' });
    }
  });

  it('should throw when no session userId', () => {
    const ctx = createMockContext({});

    try {
      guard.canActivate(ctx as never);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
    }
  });

  it('should allow when authenticated exactly at the boundary (15 min)', () => {
    // Exactly at 15 min - should still pass (equal, not greater)
    const ctx = createMockContext({
      userId: 'u1',
      authenticatedAt: Date.now() - 15 * 60 * 1000,
    });
    // At exact boundary, elapsed === RECENT_AUTH_WINDOW_MS, not > — should pass
    expect(guard.canActivate(ctx as never)).toBe(true);
  });
});

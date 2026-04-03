import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

/**
 * Updated tests for Sprint 2 — includes session creation on verify,
 * session destruction, CSRF token generation, and /me endpoint.
 */
describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    sendMagicLink: ReturnType<typeof vi.fn>;
    verifyMagicLink: ReturnType<typeof vi.fn>;
    getUserById: ReturnType<typeof vi.fn>;
    getWorkspaceById: ReturnType<typeof vi.fn>;
  };

  // Mock session
  const mockSession: Record<string, unknown> = {};
  const mockReq = () => ({
    session: { ...mockSession },
    sessionID: 'test-session-id',
    app: {
      get: vi.fn().mockReturnValue((_req: unknown, _res: unknown) => 'mock-csrf-token'),
    },
  });
  const mockRes = () => ({});

  beforeEach(() => {
    authService = {
      sendMagicLink: vi.fn().mockResolvedValue(undefined),
      verifyMagicLink: vi.fn(),
      getUserById: vi.fn(),
      getWorkspaceById: vi.fn(),
    };

    controller = new AuthController(authService as unknown as AuthService);

    // Reset session
    Object.keys(mockSession).forEach((k) => delete mockSession[k]);
  });

  describe('POST /auth/magic-link', () => {
    it('should return 202 with valid email', async () => {
      const result = await controller.sendMagicLink({ email: 'user@example.com' });
      expect(result.message).toContain('you will receive a login link');
    });

    it('should reject invalid email', async () => {
      await expect(controller.sendMagicLink({ email: 'not-an-email' })).rejects.toThrow();
    });

    it('should reject empty body', async () => {
      await expect(controller.sendMagicLink({})).rejects.toThrow();
    });
  });

  describe('GET /auth/verify', () => {
    it('should return user and workspace on valid token', async () => {
      authService.verifyMagicLink.mockResolvedValue({
        user: { id: 'u1', email: 'a@b.com', locale: 'es-ES' },
        workspace: { id: 'w1', name: 'Mi espacio de trabajo' },
      });

      const req = mockReq();
      // Mock session regeneration and saving
      (req.session as Record<string, unknown>).regenerate = vi.fn((cb: (e?: Error) => void) => cb());
      (req.session as Record<string, unknown>).save = vi.fn((cb: (e?: Error) => void) => cb());

      const result = await controller.verifyToken({ token: 'valid-token' }, req as never, mockRes() as never);

      expect(result.user.id).toBe('u1');
      expect(result.workspace.id).toBe('w1');
    });

    it('should set session data on verify', async () => {
      authService.verifyMagicLink.mockResolvedValue({
        user: { id: 'u1', email: 'a@b.com', locale: 'es-ES' },
        workspace: { id: 'w1', name: 'Test' },
      });

      const req = mockReq();
      const sessionData: Record<string, unknown> = {};
      (req.session as Record<string, unknown>).regenerate = vi.fn((cb: (e?: Error) => void) => cb());
      (req.session as Record<string, unknown>).save = vi.fn((cb: (e?: Error) => void) => cb());

      // Capture session writes
      Object.defineProperty(req, 'session', {
        get: () => sessionData,
        set: () => {},
      });
      sessionData.regenerate = vi.fn((cb: (e?: Error) => void) => cb());
      sessionData.save = vi.fn((cb: (e?: Error) => void) => cb());

      await controller.verifyToken({ token: 'valid-token' }, req as never, mockRes() as never);

      expect(sessionData.userId).toBe('u1');
      expect(sessionData.email).toBe('a@b.com');
      expect(sessionData.workspaceId).toBe('w1');
      expect(sessionData.authenticatedAt).toBeGreaterThan(0);
    });

    it('should reject missing token', async () => {
      await expect(controller.verifyToken({}, {} as never, {} as never)).rejects.toThrow();
    });
  });

  describe('DELETE /auth/session', () => {
    it('should destroy an active session', async () => {
      const req = {
        session: {
          userId: 'u1',
          destroy: vi.fn((cb: (e?: Error) => void) => cb()),
        },
      };

      await controller.destroySession(req as never);
      expect(req.session.destroy).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when no session', async () => {
      const req = { session: {} };
      await expect(controller.destroySession(req as never)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /auth/csrf-token', () => {
    it('should return a CSRF token', () => {
      const req = mockReq();
      const res = mockRes();
      const result = controller.getCsrfToken(req as never, res as never);

      expect(result.token).toBe('mock-csrf-token');
    });
  });

  describe('GET /auth/me', () => {
    it('should return user and workspace when session is valid', async () => {
      authService.getUserById.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        locale: 'es-ES',
      } as never);
      authService.getWorkspaceById.mockResolvedValue({
        id: 'w1',
        name: 'Mi espacio de trabajo',
      } as never);

      const req = {
        session: {
          userId: 'u1',
          workspaceId: 'w1',
        },
      };

      const result = await controller.getCurrentUser(req as never);

      expect(result).not.toBeNull();
      expect(result!.user.id).toBe('u1');
      expect(result!.user.email).toBe('test@example.com');
      expect(result!.workspace.id).toBe('w1');
      expect(result!.workspace.name).toBe('Mi espacio de trabajo');
    });

    it('should return null when no session', async () => {
      const req = { session: {} };

      const result = await controller.getCurrentUser(req as never);

      expect(result).toBeNull();
    });

    it('should return null when user not found', async () => {
      authService.getUserById.mockResolvedValue(null);

      const req = {
        session: {
          userId: 'nonexistent',
          workspaceId: 'w1',
        },
      };

      const result = await controller.getCurrentUser(req as never);

      expect(result).toBeNull();
    });

    it('should return null when workspace not found', async () => {
      authService.getUserById.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        locale: 'es-ES',
      } as never);
      authService.getWorkspaceById.mockResolvedValue(null);

      const req = {
        session: {
          userId: 'u1',
          workspaceId: 'nonexistent',
        },
      };

      const result = await controller.getCurrentUser(req as never);

      expect(result).toBeNull();
    });
  });
});

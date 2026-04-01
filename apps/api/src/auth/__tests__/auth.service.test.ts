import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { EmailService } from '../email.service';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: { sign: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };
  let emailService: { sendMagicLink: ReturnType<typeof vi.fn> };
  let userRepo: Record<string, ReturnType<typeof vi.fn>>;
  let workspaceRepo: Record<string, ReturnType<typeof vi.fn>>;
  let memberRepo: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    jwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
      verify: vi.fn(),
    };

    emailService = {
      sendMagicLink: vi.fn().mockResolvedValue(undefined),
    };

    userRepo = {
      findOne: vi.fn(),
      create: vi.fn((data: Record<string, unknown>) => ({ id: 'user-uuid', ...data })),
      save: vi.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'user-uuid' }),
      ),
    };

    workspaceRepo = {
      findOne: vi.fn(),
      create: vi.fn((data: Record<string, unknown>) => ({ id: 'ws-uuid', ...data })),
      save: vi.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'ws-uuid' }),
      ),
    };

    memberRepo = {
      create: vi.fn((data: Record<string, unknown>) => ({ id: 'member-uuid', ...data })),
      save: vi.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'member-uuid' }),
      ),
    };

    // Direct construction — no NestJS DI overhead in unit tests
    authService = new AuthService(
      jwtService as never,
      emailService as unknown as EmailService,
      userRepo as never,
      workspaceRepo as never,
      memberRepo as never,
    );
  });

  describe('sendMagicLink', () => {
    it('should sign a JWT and send an email', async () => {
      process.env.MAGIC_LINK_URL = 'http://localhost:5173/auth/verify';

      await authService.sendMagicLink('test@example.com');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'test@example.com', purpose: 'magic-link' },
        { expiresIn: '15m' },
      );
      expect(emailService.sendMagicLink).toHaveBeenCalledWith({
        to: 'test@example.com',
        magicLinkUrl: expect.stringContaining('mock-jwt-token'),
      });
    });
  });

  describe('verifyMagicLink', () => {
    it('should create a new user, workspace, and member on first login', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'new@example.com',
        purpose: 'magic-link',
      });
      userRepo.findOne.mockResolvedValue(null);
      workspaceRepo.findOne.mockResolvedValue(null);

      const result = await authService.verifyMagicLink('valid-token');

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', locale: 'es-ES' }),
      );
      expect(userRepo.save).toHaveBeenCalled();
      expect(workspaceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Mi espacio de trabajo', primaryLanguage: 'es' }),
      );
      // A-023: workspace_members record created with owner role
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'owner' }),
      );
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result.user.email).toBe('new@example.com');
      expect(result.workspace.name).toBe('Mi espacio de trabajo');
    });

    it('should return existing user and workspace on subsequent login', async () => {
      const existingUser = {
        id: 'existing-user',
        email: 'user@example.com',
        locale: 'es-ES',
        status: 'active',
        lastLoginAt: null,
      };
      const existingWorkspace = {
        id: 'existing-ws',
        ownerUserId: 'existing-user',
        name: 'Existing workspace',
        primaryLanguage: 'es',
      };

      jwtService.verify.mockReturnValue({
        sub: 'user@example.com',
        purpose: 'magic-link',
      });
      userRepo.findOne.mockResolvedValue(existingUser);
      workspaceRepo.findOne.mockResolvedValue(existingWorkspace);

      const result = await authService.verifyMagicLink('valid-token');

      expect(userRepo.create).not.toHaveBeenCalled();
      expect(workspaceRepo.create).not.toHaveBeenCalled();
      // Should NOT create a member record for existing workspace
      expect(memberRepo.create).not.toHaveBeenCalled();
      expect(result.user.email).toBe('user@example.com');
      expect(result.workspace.name).toBe('Existing workspace');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(authService.verifyMagicLink('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong purpose', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user@example.com',
        purpose: 'password-reset',
      });

      await expect(authService.verifyMagicLink('wrong-purpose-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should update lastLoginAt on every login', async () => {
      const existingUser = {
        id: 'u1',
        email: 'user@example.com',
        locale: 'es-ES',
        status: 'active',
        lastLoginAt: new Date('2025-01-01'),
      };
      jwtService.verify.mockReturnValue({
        sub: 'user@example.com',
        purpose: 'magic-link',
      });
      userRepo.findOne.mockResolvedValue(existingUser);
      workspaceRepo.findOne.mockResolvedValue({ id: 'ws1', name: 'ws' });

      await authService.verifyMagicLink('valid-token');

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      );
    });
  });
});

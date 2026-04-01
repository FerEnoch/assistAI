import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SourceService } from '../source.service';
import { DriveOAuthService } from '../drive-oauth.service';
import { encrypt } from '@assistai/shared';
import { randomBytes } from 'node:crypto';

const TEST_KEY = randomBytes(32).toString('hex');

describe('SourceService', () => {
  let sourceService: SourceService;
  let sourceRepo: Record<string, ReturnType<typeof vi.fn>>;
  let syncRunRepo: Record<string, ReturnType<typeof vi.fn>>;
  let driveOAuth: Partial<DriveOAuthService>;
  let discoveryQueue: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;

    sourceRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn((data: Record<string, unknown>) => ({ id: 'src-uuid', ...data })),
      save: vi.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'src-uuid' }),
      ),
    };

    syncRunRepo = {
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((data: Record<string, unknown>) => ({ id: 'run-uuid', ...data })),
      save: vi.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'run-uuid' }),
      ),
    };

    driveOAuth = {
      getAuthorizationUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?scope=...'),
      exchangeCode: vi.fn().mockResolvedValue({
        accessToken: 'ya29.mock',
        refreshToken: '1//mock-refresh',
        expiryDate: Date.now() + 3600000,
        email: 'user@gmail.com',
      }),
      revokeToken: vi.fn().mockResolvedValue(undefined),
    };

    discoveryQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    sourceService = new SourceService(
      sourceRepo as never,
      syncRunRepo as never,
      driveOAuth as unknown as DriveOAuthService,
      discoveryQueue as never,
    );
  });

  describe('getConnectUrl', () => {
    it('should generate an authorization URL with state', () => {
      const url = sourceService.getConnectUrl('ws-1', 'sess-1');
      expect(url).toContain('accounts.google.com');
      expect(driveOAuth.getAuthorizationUrl).toHaveBeenCalledWith(
        expect.any(String),
      );

      // Verify state contains workspaceId and sessionId
      const call = (driveOAuth.getAuthorizationUrl as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const decoded = JSON.parse(Buffer.from(call, 'base64url').toString('utf8'));
      expect(decoded.workspaceId).toBe('ws-1');
      expect(decoded.sessionId).toBe('sess-1');
    });
  });

  describe('handleCallback', () => {
    it('should exchange code and store encrypted tokens', async () => {
      sourceRepo.findOne.mockResolvedValue(null);
      const state = Buffer.from(JSON.stringify({ workspaceId: 'ws-1', sessionId: 'sess-1' })).toString('base64url');

      const source = await sourceService.handleCallback('auth-code', state, 'sess-1');

      expect(driveOAuth.exchangeCode).toHaveBeenCalledWith('auth-code');
      expect(source.sourceType).toBe('google_drive');
      expect(source.status).toBe('connected');

      // Token should be encrypted, not plaintext
      expect(source.googleRefreshTokenEnc).not.toContain('1//');
      expect(source.googleRefreshTokenEnc).toContain(':'); // iv:authTag:ciphertext format
    });

    it('should reject mismatched session IDs', async () => {
      const state = Buffer.from(JSON.stringify({ workspaceId: 'ws-1', sessionId: 'sess-1' })).toString('base64url');

      await expect(
        sourceService.handleCallback('code', state, 'different-session'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid state', async () => {
      await expect(
        sourceService.handleCallback('code', 'not-valid-base64', 'sess-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disconnect', () => {
    it('should revoke token, null DB column, and set status to disconnected', async () => {
      const encToken = encrypt('1//real-token', TEST_KEY);
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        googleRefreshTokenEnc: encToken,
        status: 'connected',
      });

      await sourceService.disconnect('src-1', 'ws-1');

      expect(driveOAuth.revokeToken).toHaveBeenCalledWith('1//real-token');
      expect(sourceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          googleRefreshTokenEnc: null,
          status: 'disconnected',
        }),
      );
    });

    it('should throw NotFoundException for non-existent source', async () => {
      sourceRepo.findOne.mockResolvedValue(null);

      await expect(
        sourceService.disconnect('non-existent', 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('registerSelection', () => {
    it('should update root locator, create sync run, and enqueue discovery job', async () => {
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'connected',
      });

      const run = await sourceService.registerSelection('src-1', 'ws-1', 'folder:/legal-docs');

      expect(sourceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ rootLocator: 'folder:/legal-docs' }),
      );
      expect(syncRunRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'src-1', status: 'running' }),
      );
      expect(run.status).toBe('running');

      // Verify discovery job was enqueued (A-040)
      expect(discoveryQueue.add).toHaveBeenCalledWith(
        'discovery',
        expect.objectContaining({
          sourceId: 'src-1',
          workspaceId: 'ws-1',
          syncRunId: 'run-uuid',
        }),
        expect.objectContaining({
          attempts: 3,
        }),
      );
    });

    it('should reject when source is not connected', async () => {
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        status: 'disconnected',
      });

      await expect(
        sourceService.registerSelection('src-1', 'ws-1', 'folder:/docs'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getConnectionStatus', () => {
    it('should return source status info', async () => {
      sourceRepo.findOne.mockResolvedValue({
        id: 'src-1',
        workspaceId: 'ws-1',
        sourceType: 'google_drive',
        status: 'connected',
        rootLocator: 'user@gmail.com',
        lastSyncedAt: null,
        googleRefreshTokenEnc: 'encrypted-value',
      });

      const status = await sourceService.getConnectionStatus('src-1', 'ws-1');

      expect(status.id).toBe('src-1');
      expect(status.status).toBe('connected');
      expect(status.connectedEmail).toBe('user@gmail.com');
      expect(status.hasToken).toBe(true);
    });
  });

  describe('getDecryptedRefreshToken', () => {
    it('should decrypt stored token', () => {
      const original = '1//mock-refresh-token';
      const encrypted = encrypt(original, TEST_KEY);
      const source = { googleRefreshTokenEnc: encrypted } as never;

      const result = sourceService.getDecryptedRefreshToken(source);
      expect(result).toBe(original);
    });

    it('should throw when no token stored', () => {
      const source = { googleRefreshTokenEnc: null } as never;
      expect(() => sourceService.getDecryptedRefreshToken(source)).toThrow(BadRequestException);
    });
  });
});

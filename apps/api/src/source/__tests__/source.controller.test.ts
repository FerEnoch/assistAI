import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, HttpException } from '@nestjs/common';
import { SourceController } from '../source.controller';
import { SourceService } from '../source.service';
import { DriveOAuthService } from '../drive-oauth.service';
import type { ContentSource } from '@assistai/entities';

describe('SourceController', () => {
  let controller: SourceController;
  let sourceService: Partial<Record<keyof SourceService, ReturnType<typeof vi.fn>>>;
  let driveOAuth: Partial<Record<keyof DriveOAuthService, ReturnType<typeof vi.fn>>>;

  const mockRes = () => ({ redirect: vi.fn() });
  const mockReq = (overrides: Record<string, unknown> = {}) => ({
    session: { workspaceId: 'ws-1', userId: 'u-1' },
    sessionID: 'sess-abc',
    ...overrides,
  });

  beforeEach(() => {
    sourceService = {
      getConnectUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth?state=xyz'),
      handleCallback: vi.fn().mockResolvedValue({ id: 'src-1', status: 'connected' } as ContentSource),
      getSourcesForWorkspace: vi.fn().mockResolvedValue([]),
      getSource: vi.fn().mockResolvedValue({ id: 'src-1' } as ContentSource),
      getDecryptedRefreshToken: vi.fn().mockReturnValue('1//mock-token'),
      getConnectionStatus: vi.fn().mockResolvedValue({ id: 'src-1', status: 'connected' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      registerSelection: vi.fn().mockResolvedValue({ id: 'run-1', status: 'running' }),
      getSyncRuns: vi.fn().mockResolvedValue([]),
      triggerResync: vi.fn().mockResolvedValue({ id: 'run-2', status: 'running' }),
    };

    driveOAuth = {
      refreshAccessToken: vi.fn().mockResolvedValue({ accessToken: 'ya29.mock', expiryDate: Date.now() + 3600000 }),
      listFiles: vi.fn().mockResolvedValue({ files: [], nextPageToken: undefined }),
    };

    controller = new SourceController(
      sourceService as unknown as SourceService,
      driveOAuth as unknown as DriveOAuthService,
    );
  });

  afterEach(() => {
    delete process.env.WEB_URL;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /sources/drive/connect
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /sources/drive/connect', () => {
    it('should redirect to the Google OAuth URL', () => {
      const req = mockReq();
      const res = mockRes();

      controller.connectDrive(req as never, res as never);

      expect(sourceService.getConnectUrl).toHaveBeenCalledWith('ws-1', 'sess-abc');
      expect(res.redirect).toHaveBeenCalledWith('https://accounts.google.com/oauth?state=xyz');
    });

    it('should throw BadRequestException when workspaceId is missing from session', () => {
      const req = mockReq({ session: { userId: 'u-1' } }); // no workspaceId
      const res = mockRes();

      expect(() => controller.connectDrive(req as never, res as never)).toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /sources/drive/callback
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /sources/drive/callback', () => {
    it('should redirect to WEB_URL/library?source=connected after successful callback', async () => {
      process.env.WEB_URL = 'http://localhost:5173';

      const req = mockReq();
      const res = mockRes();

      await controller.driveCallback('auth-code', 'state-xyz', req as never, res as never);

      expect(sourceService.handleCallback).toHaveBeenCalledWith('auth-code', 'state-xyz', 'sess-abc');
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/library?source=connected');
    });

    it('should use the fallback URL when WEB_URL is not set', async () => {
      delete process.env.WEB_URL;

      const req = mockReq();
      const res = mockRes();

      await controller.driveCallback('auth-code', 'state-xyz', req as never, res as never);

      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/library?source=connected');
    });

    it('should redirect to a custom WEB_URL in production', async () => {
      process.env.WEB_URL = 'https://app.assistai.com';

      const req = mockReq();
      const res = mockRes();

      await controller.driveCallback('auth-code', 'state-xyz', req as never, res as never);

      expect(res.redirect).toHaveBeenCalledWith('https://app.assistai.com/library?source=connected');
    });

    it('should never redirect to a relative path (regression)', async () => {
      process.env.WEB_URL = 'http://localhost:5173';

      const req = mockReq();
      const res = mockRes();

      await controller.driveCallback('auth-code', 'state-xyz', req as never, res as never);

      const redirectArg: string = (res.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectArg).toMatch(/^https?:\/\//);
    });

    it('should throw BadRequestException when code is missing', async () => {
      const req = mockReq();
      const res = mockRes();

      await expect(
        controller.driveCallback(undefined, 'state-xyz', req as never, res as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when state is missing', async () => {
      const req = mockReq();
      const res = mockRes();

      await expect(
        controller.driveCallback('auth-code', undefined, req as never, res as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /sources
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /sources', () => {
    it('should return sanitized sources without sensitive fields', async () => {
      const rawSources = [{
        id: 'src-1',
        workspaceId: 'ws-1',
        sourceType: 'google_drive',
        status: 'connected',
        connectedAccountEmail: 'user@example.com',
        rootLocator: '/docs',
        lastSyncedAt: null,
        googleRefreshTokenEnc: 'enc-secret-token',
        keyVersion: 2,
        selectedFileIds: ['file-1', 'file-2'],
        changesPageToken: 'page-token-123',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      }];
      sourceService.getSourcesForWorkspace!.mockResolvedValue(rawSources);

      const result = await controller.listSources(mockReq() as never);

      expect(sourceService.getSourcesForWorkspace).toHaveBeenCalledWith('ws-1');
      // Must NOT expose sensitive fields
      expect(result).toEqual([{
        id: 'src-1',
        workspaceId: 'ws-1',
        sourceType: 'google_drive',
        status: 'connected',
        connectedAccountEmail: 'user@example.com',
        rootLocator: '/docs',
        lastSyncedAt: null,
        hasToken: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      }]);
      // Explicitly verify sensitive fields are stripped
      const returned = result[0];
      expect(returned).not.toHaveProperty('googleRefreshTokenEnc');
      expect(returned).not.toHaveProperty('keyVersion');
      expect(returned).not.toHaveProperty('selectedFileIds');
      expect(returned).not.toHaveProperty('changesPageToken');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /sources/:id/select
  // ──────────────────────────────────────────────────────────────────────────
  describe('POST /sources/:id/select', () => {
    it('should register selection with fileIds and return sync run', async () => {
      const fileIds = ['file-1', 'file-2'];
      const result = await controller.selectFiles('src-1', { rootLocator: 'folder:/docs', fileIds }, mockReq() as never);

      expect(sourceService.registerSelection).toHaveBeenCalledWith('src-1', 'ws-1', 'folder:/docs', fileIds);
      expect(result).toEqual({ id: 'run-1', status: 'running' });
    });

    it('should register selection without fileIds (full scan)', async () => {
      const result = await controller.selectFiles('src-1', { rootLocator: 'folder:/docs' }, mockReq() as never);

      expect(sourceService.registerSelection).toHaveBeenCalledWith('src-1', 'ws-1', 'folder:/docs', undefined);
      expect(result).toEqual({ id: 'run-1', status: 'running' });
    });

    it('should throw BadRequestException when rootLocator is missing', async () => {
      await expect(
        controller.selectFiles('src-1', {} as never, mockReq() as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /sources/:id/files — reauth detection
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /sources/:id/files — reauth detection', () => {
    it('should return REAUTH_REQUIRED on 401 invalid_grant', async () => {
      sourceService.markNeedsReauth = vi.fn().mockResolvedValue(undefined);
      driveOAuth.refreshAccessToken!.mockRejectedValue(
        Object.assign(new Error('invalid_grant'), { response: { status: 401 } }),
      );

      await expect(
        controller.listDriveFiles('src-1', undefined, undefined, mockReq() as never),
      ).rejects.toThrow(HttpException);

      expect(sourceService.markNeedsReauth).toHaveBeenCalledWith('src-1', 'ws-1');
    });

    it('should return REAUTH_REQUIRED on 403 with insufficient_scope', async () => {
      sourceService.markNeedsReauth = vi.fn().mockResolvedValue(undefined);
      driveOAuth.refreshAccessToken!.mockRejectedValue(
        Object.assign(new Error('insufficient_scope: requires drive.readonly'), { response: { status: 403 } }),
      );

      await expect(
        controller.listDriveFiles('src-1', undefined, undefined, mockReq() as never),
      ).rejects.toThrow(HttpException);

      expect(sourceService.markNeedsReauth).toHaveBeenCalledWith('src-1', 'ws-1');
    });

    it('should NOT trigger reauth on bare 403 per-file permission error', async () => {
      sourceService.markNeedsReauth = vi.fn();
      driveOAuth.refreshAccessToken!.mockRejectedValue(
        Object.assign(new Error('Insufficient Permission'), { response: { status: 403 } }),
      );

      await expect(
        controller.listDriveFiles('src-1', undefined, undefined, mockReq() as never),
      ).rejects.toThrow();

      expect(sourceService.markNeedsReauth).not.toHaveBeenCalled();
    });

    it('should NOT trigger reauth on unrelated 500 errors', async () => {
      sourceService.markNeedsReauth = vi.fn();
      driveOAuth.refreshAccessToken!.mockRejectedValue(
        Object.assign(new Error('Internal server error'), { response: { status: 500 } }),
      );

      await expect(
        controller.listDriveFiles('src-1', undefined, undefined, mockReq() as never),
      ).rejects.toThrow();

      expect(sourceService.markNeedsReauth).not.toHaveBeenCalled();
    });

    it('should detect token revoked message even without status code', async () => {
      sourceService.markNeedsReauth = vi.fn().mockResolvedValue(undefined);
      driveOAuth.refreshAccessToken!.mockRejectedValue(new Error('Token has been revoked'));

      await expect(
        controller.listDriveFiles('src-1', undefined, undefined, mockReq() as never),
      ).rejects.toThrow(HttpException);

      expect(sourceService.markNeedsReauth).toHaveBeenCalledWith('src-1', 'ws-1');
    });
  });
});

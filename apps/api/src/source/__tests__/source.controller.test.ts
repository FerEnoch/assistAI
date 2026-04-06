import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
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
    it('should redirect to WEB_URL/dashboard?source=connected after successful callback', async () => {
      process.env.WEB_URL = 'http://localhost:5173';

      const req = mockReq();
      const res = mockRes();

      await controller.driveCallback('auth-code', 'state-xyz', req as never, res as never);

      expect(sourceService.handleCallback).toHaveBeenCalledWith('auth-code', 'state-xyz', 'sess-abc');
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/dashboard?source=connected');
    });

    it('should use the fallback URL when WEB_URL is not set', async () => {
      delete process.env.WEB_URL;

      const req = mockReq();
      const res = mockRes();

      await controller.driveCallback('auth-code', 'state-xyz', req as never, res as never);

      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/dashboard?source=connected');
    });

    it('should redirect to a custom WEB_URL in production', async () => {
      process.env.WEB_URL = 'https://app.assistai.com';

      const req = mockReq();
      const res = mockRes();

      await controller.driveCallback('auth-code', 'state-xyz', req as never, res as never);

      expect(res.redirect).toHaveBeenCalledWith('https://app.assistai.com/dashboard?source=connected');
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
    it('should return sources for the current workspace', async () => {
      const mockSources = [{ id: 'src-1', sourceType: 'google_drive', status: 'connected' }];
      sourceService.getSourcesForWorkspace!.mockResolvedValue(mockSources);

      const result = await controller.listSources(mockReq() as never);

      expect(sourceService.getSourcesForWorkspace).toHaveBeenCalledWith('ws-1');
      expect(result).toEqual(mockSources);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /sources/:id/select
  // ──────────────────────────────────────────────────────────────────────────
  describe('POST /sources/:id/select', () => {
    it('should register selection and return sync run', async () => {
      const result = await controller.selectFiles('src-1', { rootLocator: 'folder:/docs' }, mockReq() as never);

      expect(sourceService.registerSelection).toHaveBeenCalledWith('src-1', 'ws-1', 'folder:/docs');
      expect(result).toEqual({ id: 'run-1', status: 'running' });
    });

    it('should throw BadRequestException when rootLocator is missing', async () => {
      await expect(
        controller.selectFiles('src-1', {} as never, mockReq() as never),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

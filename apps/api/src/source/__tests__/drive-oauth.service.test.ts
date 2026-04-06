import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — the factory must be self-contained (no top-level vars)
vi.mock('googleapis', () => {
  const mockGenerateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=1');
  const mockGetToken = vi.fn();
  const mockVerifyIdToken = vi.fn();
  const mockRefreshAccessToken = vi.fn();
  const mockRevokeToken = vi.fn();
  const mockFilesList = vi.fn();

  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          generateAuthUrl: mockGenerateAuthUrl,
          getToken: mockGetToken,
          verifyIdToken: mockVerifyIdToken,
          setCredentials: vi.fn(),
          refreshAccessToken: mockRefreshAccessToken,
          revokeToken: mockRevokeToken,
        })),
      },
      drive: vi.fn().mockReturnValue({
        files: { list: mockFilesList },
      }),
    },
  };
});

import { google } from 'googleapis';
import { DriveOAuthService } from '../drive-oauth.service';

// Helper to grab the mocked OAuth2Client instance created in the constructor
function getOAuth2ClientMock() {
  const OAuth2Constructor = vi.mocked(google.auth.OAuth2);
  return OAuth2Constructor.mock.results[OAuth2Constructor.mock.results.length - 1].value as {
    generateAuthUrl: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
    verifyIdToken: ReturnType<typeof vi.fn>;
    refreshAccessToken: ReturnType<typeof vi.fn>;
    revokeToken: ReturnType<typeof vi.fn>;
  };
}

describe('DriveOAuthService', () => {
  let service: DriveOAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DriveOAuthService();
  });

  // ──────────────────────────────────────────────
  // T-1.2: scope verification
  // ──────────────────────────────────────────────
  describe('getAuthorizationUrl()', () => {
    it('includes drive.readonly scope', () => {
      service.getAuthorizationUrl('state-abc');

      const mock = getOAuth2ClientMock();
      const callArgs = mock.generateAuthUrl.mock.calls[0][0] as { scope: string[] };
      expect(callArgs.scope).toContain('https://www.googleapis.com/auth/drive.readonly');
    });

    it('does NOT include drive.file scope', () => {
      service.getAuthorizationUrl('state-abc');

      const mock = getOAuth2ClientMock();
      const callArgs = mock.generateAuthUrl.mock.calls[0][0] as { scope: string[] };
      expect(callArgs.scope).not.toContain('https://www.googleapis.com/auth/drive.file');
    });

    it('includes openid and email scopes', () => {
      service.getAuthorizationUrl('state-abc');

      const mock = getOAuth2ClientMock();
      const callArgs = mock.generateAuthUrl.mock.calls[0][0] as { scope: string[] };
      expect(callArgs.scope).toContain('openid');
      expect(callArgs.scope).toContain('email');
    });

    it('passes state, offline access_type and consent prompt', () => {
      service.getAuthorizationUrl('my-state-token');

      const mock = getOAuth2ClientMock();
      const callArgs = mock.generateAuthUrl.mock.calls[0][0] as {
        state: string;
        access_type: string;
        prompt: string;
      };
      expect(callArgs.state).toBe('my-state-token');
      expect(callArgs.access_type).toBe('offline');
      expect(callArgs.prompt).toBe('consent');
    });

    it('returns the URL from OAuth2Client', () => {
      const url = service.getAuthorizationUrl('state-xyz');
      expect(url).toBe('https://accounts.google.com/o/oauth2/auth?mock=1');
    });
  });

  // ──────────────────────────────────────────────
  // exchangeCode()
  // ──────────────────────────────────────────────
  describe('exchangeCode()', () => {
    it('throws when no refresh_token is received', async () => {
      const mock = getOAuth2ClientMock();
      mock.getToken.mockResolvedValueOnce({ tokens: { access_token: 'acc', id_token: null } });

      await expect(service.exchangeCode('code-123')).rejects.toThrow(
        'No refresh token received',
      );
    });

    it('throws when no access_token is received', async () => {
      const mock = getOAuth2ClientMock();
      mock.getToken.mockResolvedValueOnce({
        tokens: { refresh_token: 'ref', access_token: null },
      });

      await expect(service.exchangeCode('code-123')).rejects.toThrow(
        'No access token received',
      );
    });

    it('returns tokens and email on success', async () => {
      const mock = getOAuth2ClientMock();
      mock.getToken.mockResolvedValueOnce({
        tokens: {
          access_token: 'acc-token',
          refresh_token: 'ref-token',
          expiry_date: 9999999,
          id_token: 'id-tok',
        },
      });
      mock.verifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({ email: 'user@example.com' }),
      });

      const result = await service.exchangeCode('code-abc');

      expect(result.accessToken).toBe('acc-token');
      expect(result.refreshToken).toBe('ref-token');
      expect(result.expiryDate).toBe(9999999);
      expect(result.email).toBe('user@example.com');
    });
  });

  // ──────────────────────────────────────────────
  // refreshAccessToken()
  // ──────────────────────────────────────────────
  describe('refreshAccessToken()', () => {
    it('throws when credentials have no access_token', async () => {
      const mock = getOAuth2ClientMock();
      mock.refreshAccessToken.mockResolvedValueOnce({ credentials: {} });

      await expect(service.refreshAccessToken('ref-tok')).rejects.toThrow(
        'Failed to refresh access token',
      );
    });

    it('returns new access token and expiry', async () => {
      const mock = getOAuth2ClientMock();
      mock.refreshAccessToken.mockResolvedValueOnce({
        credentials: { access_token: 'new-acc', expiry_date: 123456 },
      });

      const result = await service.refreshAccessToken('ref-tok');
      expect(result.accessToken).toBe('new-acc');
      expect(result.expiryDate).toBe(123456);
    });
  });
});

import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

/**
 * Google Drive OAuth flow handler.
 * Scopes: drive.readonly (read all Drive files) + openid email per MVP §2.5.
 */
@Injectable()
export class DriveOAuthService {
  private readonly logger = new Logger(DriveOAuthService.name);
  private readonly oauth2Client: OAuth2Client;

  /** Read-only access to all Drive files — drive.file only shows files opened by the app */
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'openid',
    'email',
  ];

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  /**
   * Generate the Google OAuth authorization URL.
   * Includes state parameter for CSRF protection on the OAuth callback.
   */
  getAuthorizationUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: DriveOAuthService.SCOPES,
      state,
      prompt: 'consent', // Always get refresh token
      include_granted_scopes: false,
    });
  }

  /**
   * Exchange authorization code for tokens.
   * Returns the full token response including refresh_token and access_token.
   */
  async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    email?: string;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received — user may need to revoke app access and retry');
    }
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Decode the ID token to get the user's email
    let email: string | undefined;
    if (tokens.id_token) {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email;
    }

    this.logger.log(`Google OAuth tokens exchanged for ${email ?? 'unknown'}`);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date ?? Date.now() + 3600 * 1000,
      email,
    };
  }

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiryDate: number;
  }> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    };
  }

  /**
   * Revoke a token (used during disconnect).
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(token);
      this.logger.log('Google token revoked successfully');
    } catch (err) {
      this.logger.warn('Failed to revoke Google token (may already be revoked)', err);
    }
  }

  /**
   * List files accessible by the user's access token.
   * Used for the file/folder picker UI.
   */
  async listFiles(
    accessToken: string,
    options: { query?: string; pageToken?: string; pageSize?: number } = {},
  ): Promise<{
    files: Array<{ id: string; name: string; mimeType: string; parents?: string[] }>;
    nextPageToken?: string;
  }> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const res = await drive.files.list({
      pageSize: options.pageSize ?? 20,
      pageToken: options.pageToken,
      q: options.query ?? "trashed = false",
      fields: 'nextPageToken, files(id, name, mimeType, parents)',
    });

    return {
      files: (res.data.files ?? []).map((f) => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        parents: f.parents ?? undefined,
      })),
      nextPageToken: res.data.nextPageToken ?? undefined,
    };
  }
}

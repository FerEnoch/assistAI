import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SessionGuard, RecentAuthGuard } from '../auth/guards';
import { SourceService } from './source.service';
import { DriveOAuthService } from './drive-oauth.service';
import { isDriveAuthFailure } from '@assistai/shared';
import type { ContentSource } from '@assistai/entities';

/**
 * Sanitize a ContentSource entity for API responses.
 * Strips sensitive/internal fields: encrypted tokens, key version, page tokens.
 */
function toSourceView(source: ContentSource) {
  return {
    id: source.id,
    workspaceId: source.workspaceId,
    sourceType: source.sourceType,
    status: source.status,
    connectedAccountEmail: source.connectedAccountEmail ?? null,
    rootLocator: source.rootLocator ?? null,
    lastSyncedAt: source.lastSyncedAt ?? null,
    hasToken: !!source.googleRefreshTokenEnc,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

/**
 * Helper to safely extract workspaceId from session.
 * SessionGuard guarantees userId exists, but workspaceId needs assertion.
 */
function getWorkspaceId(req: Request): string {
  const wsId = req.session?.workspaceId;
  if (!wsId) throw new BadRequestException('No workspace in session');
  return wsId;
}

@Controller('sources')
@SkipThrottle()
export class SourceController {
  constructor(
    private readonly sourceService: SourceService,
    private readonly driveOAuth: DriveOAuthService,
  ) {}

  /**
   * GET /sources/drive/connect
   * Redirect to Google OAuth consent screen.
   * Separate from product auth — per A-030.
   */
  @Get('drive/connect')
  @UseGuards(SessionGuard)
  connectDrive(@Req() req: Request, @Res() res: Response): void {
    const url = this.sourceService.getConnectUrl(getWorkspaceId(req), req.sessionID);
    res.redirect(url);
  }

  /**
   * GET /sources/drive/callback
   * Handle Google OAuth callback, store encrypted tokens, redirect to dashboard.
   */
  @Get('drive/callback')
  async driveCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('Missing OAuth code or state');
    }

    await this.sourceService.handleCallback(code, state, req.sessionID);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:5173';
    res.redirect(`${webUrl}/library?source=connected`);
  }

  /**
   * GET /sources
   * List all sources for the current workspace.
   */
  @Get()
  @UseGuards(SessionGuard)
  async listSources(@Req() req: Request) {
    const sources = await this.sourceService.getSourcesForWorkspace(getWorkspaceId(req));
    return sources.map(toSourceView);
  }

  /**
   * GET /sources/:id/status
   * Get connection status for a source (A-035).
   */
  @Get(':id/status')
  @UseGuards(SessionGuard)
  async getStatus(@Param('id') id: string, @Req() req: Request) {
    return this.sourceService.getConnectionStatus(id, getWorkspaceId(req));
  }

  /**
   * POST /sources/:id/select
   * Register file/folder selection and start a sync run (A-034).
   */
  @Post(':id/select')
  @UseGuards(SessionGuard)
  async selectFiles(
    @Param('id') id: string,
    @Body() body: { rootLocator: string; fileIds?: string[] },
    @Req() req: Request,
  ) {
    if (!body.rootLocator) {
      throw new BadRequestException('rootLocator is required');
    }
    return this.sourceService.registerSelection(
      id,
      getWorkspaceId(req),
      body.rootLocator,
      body.fileIds,
    );
  }

  /**
   * DELETE /sources/:id
   * Disconnect a source — revokes tokens, nulls DB column (A-035).
   * Requires recent authentication.
   */
  @Delete(':id')
  @UseGuards(SessionGuard, RecentAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.sourceService.disconnect(id, getWorkspaceId(req));
  }

  /**
   * GET /sources/:id/files
   * List files from connected Drive for the picker UI (A-033).
   */
  @Get(':id/files')
  @UseGuards(SessionGuard)
  async listDriveFiles(
    @Param('id') id: string,
    @Query('pageToken') pageToken: string | undefined,
    @Query('q') query: string | undefined,
    @Req() req: Request,
  ) {
    const source = await this.sourceService.getSource(id, getWorkspaceId(req));
    const refreshToken = this.sourceService.getDecryptedRefreshToken(source);

    try {
      const { accessToken } = await this.driveOAuth.refreshAccessToken(refreshToken);
      return await this.driveOAuth.listFiles(accessToken, { query, pageToken });
    } catch (err: any) {
      // Use shared classifier — only genuine token/OAuth failures trigger reauth,
      // not ordinary per-file 403s
      if (isDriveAuthFailure(err)) {
        await this.sourceService.markNeedsReauth(id, getWorkspaceId(req));
        throw new HttpException(
          { error: { code: 'REAUTH_REQUIRED', message: 'Drive requires re-authentication' } },
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw err;
    }
  }

  /**
   * GET /sources/:id/sync-runs
   * Get sync run history for a source.
   */
  @Get(':id/sync-runs')
  @UseGuards(SessionGuard)
  async getSyncRuns(@Param('id') id: string, @Req() req: Request) {
    return this.sourceService.getSyncRuns(id, getWorkspaceId(req));
  }

  /**
   * POST /sources/:id/resync
   * Manually trigger a re-sync for a source (A-046).
   * Creates a new sync run and enqueues a discovery job.
   */
  @Post(':id/resync')
  @UseGuards(SessionGuard)
  async resync(@Param('id') id: string, @Req() req: Request) {
    return this.sourceService.triggerResync(id, getWorkspaceId(req));
  }
}

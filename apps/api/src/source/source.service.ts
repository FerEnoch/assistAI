import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { encrypt, decrypt, QUEUE_NAMES, INGESTION_RETRY_POLICY } from '@assistai/shared';
import type { DiscoveryJobPayload } from '@assistai/shared';
import { ContentSource, SourceSyncRun } from '@assistai/entities';
import { DriveOAuthService } from './drive-oauth.service';

@Injectable()
export class SourceService {
  private readonly logger = new Logger(SourceService.name);

  constructor(
    @InjectRepository(ContentSource)
    private readonly sourceRepo: Repository<ContentSource>,
    @InjectRepository(SourceSyncRun)
    private readonly syncRunRepo: Repository<SourceSyncRun>,
    private readonly driveOAuth: DriveOAuthService,
    @InjectQueue(QUEUE_NAMES.INGESTION_DISCOVERY)
    private readonly discoveryQueue: Queue<DiscoveryJobPayload>,
  ) {}

  private get encryptionKey(): string {
    return process.env.CREDENTIAL_ENCRYPTION_KEY!;
  }

  /**
   * Initiate Google Drive OAuth by redirecting to Google.
   * The state includes workspaceId for verification on callback.
   */
  getConnectUrl(workspaceId: string, sessionId: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId, sessionId })).toString('base64url');
    return this.driveOAuth.getAuthorizationUrl(state);
  }

  /**
   * Handle the OAuth callback from Google.
   * Exchanges code for tokens, encrypts and stores them.
   * Creates a content_source record.
   */
  async handleCallback(
    code: string,
    stateBase64: string,
    currentSessionId: string,
  ): Promise<ContentSource> {
    // Parse and validate state
    let state: { workspaceId: string; sessionId: string };
    try {
      state = JSON.parse(Buffer.from(stateBase64, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }

    // Verify session match (OAuth CSRF protection)
    if (state.sessionId !== currentSessionId) {
      throw new BadRequestException('OAuth state session mismatch');
    }

    const { refreshToken, email } = await this.driveOAuth.exchangeCode(code);

    // Encrypt refresh token before storing (A-032 / A-090)
    const encryptedRefreshToken = encrypt(refreshToken, this.encryptionKey);

    // Check if workspace already has a Drive source
    let source = await this.sourceRepo.findOne({
      where: {
        workspaceId: state.workspaceId,
        sourceType: 'google_drive',
      },
    });

    if (source) {
      // Update existing source
      source.googleRefreshTokenEnc = encryptedRefreshToken;
      source.status = 'connected';
      source.rootLocator = email ?? null;
    } else {
      // Create new source
      source = this.sourceRepo.create({
        workspaceId: state.workspaceId,
        sourceType: 'google_drive',
        googleRefreshTokenEnc: encryptedRefreshToken,
        status: 'connected',
        rootLocator: email ?? null,
      });
    }

    source = await this.sourceRepo.save(source);
    this.logger.log(`Drive source ${source.id} connected for workspace ${state.workspaceId}`);

    return source;
  }

  /**
   * Get all sources for a workspace.
   */
  async getSourcesForWorkspace(workspaceId: string): Promise<ContentSource[]> {
    return this.sourceRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific source by ID, ensuring workspace ownership.
   */
  async getSource(sourceId: string, workspaceId: string): Promise<ContentSource> {
    const source = await this.sourceRepo.findOne({
      where: { id: sourceId, workspaceId },
    });

    if (!source) {
      throw new NotFoundException('Source not found');
    }

    return source;
  }

  /**
   * Get the decrypted refresh token for a source.
   */
  getDecryptedRefreshToken(source: ContentSource): string {
    if (!source.googleRefreshTokenEnc) {
      throw new BadRequestException('Source has no stored token');
    }
    return decrypt(source.googleRefreshTokenEnc, this.encryptionKey);
  }

  /**
   * Disconnect a source — revoke tokens, null DB column, update status (A-035).
   */
  async disconnect(sourceId: string, workspaceId: string): Promise<void> {
    const source = await this.getSource(sourceId, workspaceId);

    // Revoke the token with Google if we have one
    if (source.googleRefreshTokenEnc) {
      try {
        const refreshToken = this.getDecryptedRefreshToken(source);
        await this.driveOAuth.revokeToken(refreshToken);
      } catch (err) {
        this.logger.warn(`Failed to revoke token for source ${sourceId}`, err);
      }
    }

    // Null out the encrypted token and set status to disconnected
    source.googleRefreshTokenEnc = null;
    source.status = 'disconnected';
    await this.sourceRepo.save(source);

    this.logger.log(`Source ${sourceId} disconnected for workspace ${workspaceId}`);
  }

  /**
   * Register selected files/folders and create a sync-run record (A-034).
   * Enqueues a discovery job to the worker (A-040).
   */
  async registerSelection(
    sourceId: string,
    workspaceId: string,
    rootLocator: string,
  ): Promise<SourceSyncRun> {
    const source = await this.getSource(sourceId, workspaceId);

    if (source.status !== 'connected') {
      throw new BadRequestException('Source is not connected');
    }

    // Update root locator with selected path/folder
    source.rootLocator = rootLocator;
    await this.sourceRepo.save(source);

    // Create sync run record
    const syncRun = this.syncRunRepo.create({
      sourceId: source.id,
      status: 'running',
    });

    const saved = await this.syncRunRepo.save(syncRun);

    // Enqueue discovery job to the worker (A-040)
    await this.discoveryQueue.add(
      'discovery',
      {
        sourceId: source.id,
        workspaceId,
        syncRunId: saved.id,
      },
      {
        attempts: INGESTION_RETRY_POLICY.maxAttempts,
        backoff: {
          type: INGESTION_RETRY_POLICY.backoffType,
          delay: INGESTION_RETRY_POLICY.backoffDelay,
        },
      },
    );

    this.logger.log(`Sync run ${saved.id} created and discovery job enqueued for source ${sourceId}`);

    return saved;
  }

  /**
   * Get sync runs for a source.
   */
  async getSyncRuns(sourceId: string, workspaceId: string): Promise<SourceSyncRun[]> {
    // Verify workspace ownership
    await this.getSource(sourceId, workspaceId);

    return this.syncRunRepo.find({
      where: { sourceId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  /**
   * Get connection status for a source (A-035).
   */
  async getConnectionStatus(sourceId: string, workspaceId: string): Promise<{
    id: string;
    status: string;
    sourceType: string;
    connectedEmail: string | null;
    lastSyncedAt: Date | null;
    hasToken: boolean;
  }> {
    const source = await this.getSource(sourceId, workspaceId);

    return {
      id: source.id,
      status: source.status,
      sourceType: source.sourceType,
      connectedEmail: source.rootLocator ?? null,
      lastSyncedAt: source.lastSyncedAt ?? null,
      hasToken: !!source.googleRefreshTokenEnc,
    };
  }

  /**
   * Manually trigger a re-sync for a source (A-046).
   * Creates a new sync run and enqueues a discovery job.
   */
  async triggerResync(
    sourceId: string,
    workspaceId: string,
  ): Promise<SourceSyncRun> {
    const source = await this.getSource(sourceId, workspaceId);

    if (source.status === 'disconnected') {
      throw new BadRequestException('Cannot sync a disconnected source');
    }

    if (!source.googleRefreshTokenEnc) {
      throw new BadRequestException('Source has no stored token for syncing');
    }

    // Create sync run record
    const syncRun = this.syncRunRepo.create({
      sourceId: source.id,
      status: 'running',
    });

    const saved = await this.syncRunRepo.save(syncRun);

    // Enqueue discovery job
    await this.discoveryQueue.add(
      'discovery',
      {
        sourceId: source.id,
        workspaceId,
        syncRunId: saved.id,
      },
      {
        attempts: INGESTION_RETRY_POLICY.maxAttempts,
        backoff: {
          type: INGESTION_RETRY_POLICY.backoffType,
          delay: INGESTION_RETRY_POLICY.backoffDelay,
        },
      },
    );

    this.logger.log(`Re-sync triggered: syncRun=${saved.id} for source=${sourceId}`);

    return saved;
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { google } from 'googleapis';
import { decrypt } from '@assistai/shared';
import {
  QUEUE_NAMES,
  isSupportedMimeType,
  INGESTION_RETRY_POLICY,
} from '@assistai/shared';
import type { DiscoveryJobPayload, ParseJobPayload } from '@assistai/shared';
import { ContentSource, SourceSyncRun, Document } from '@assistai/entities';
import { shouldUseFileIdStrategy, shouldSkipForSelection } from './discovery-utils';

/**
 * Discovery processor (A-040, A-043).
 *
 * Given a sourceId, discovers files from the connected Drive source,
 * applies MIME filtering (A-041), and enqueues parse jobs for each file.
 *
 * Supports selective indexing: when the job payload contains `fileIds`,
 * only those specific files are fetched and enqueued (no full Drive scan).
 *
 * Supports incremental sync (A-043): if the source has a `changesPageToken`
 * AND no specific fileIds are requested, uses the Drive Changes API to only
 * discover changed files.
 */
@Processor(QUEUE_NAMES.INGESTION_DISCOVERY, {
  concurrency: 2,
})
export class DiscoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DiscoveryProcessor.name);

  constructor(
    @InjectRepository(ContentSource)
    private readonly sourceRepo: Repository<ContentSource>,
    @InjectRepository(SourceSyncRun)
    private readonly syncRunRepo: Repository<SourceSyncRun>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectQueue(QUEUE_NAMES.INGESTION_PARSE)
    private readonly parseQueue: Queue<ParseJobPayload>,
  ) {
    super();
  }

  private get encryptionKey(): string {
    return process.env.CREDENTIAL_ENCRYPTION_KEY!;
  }

  async process(job: Job<DiscoveryJobPayload>): Promise<{ discovered: number; enqueued: number }> {
    const { sourceId, workspaceId, syncRunId, fileIds } = job.data;
    this.logger.log(`[Discovery] Starting for source=${sourceId} syncRun=${syncRunId} fileIds=${fileIds?.length ?? 'all'}`);

    const source = await this.sourceRepo.findOne({ where: { id: sourceId } });
    if (!source || !source.googleRefreshTokenEnc) {
      throw new Error(`Source ${sourceId} not found or has no token`);
    }

    // Decrypt refresh token and get access token
    const refreshToken = decrypt(source.googleRefreshTokenEnc, this.encryptionKey);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token for Drive discovery');
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Choose discovery strategy:
    // 1. Specific fileIds → fetch only those files (no pagination, no changes API)
    // 2. changesPageToken exists → incremental sync via Changes API
    // 3. Otherwise → full scan
    let result: { discovered: number; enqueued: number };
    if (shouldUseFileIdStrategy(fileIds)) {
      result = await this.discoverByFileIds(drive, source, workspaceId, syncRunId, fileIds!);
    } else if (source.changesPageToken) {
      result = await this.discoverChanges(drive, source, workspaceId, syncRunId);
    } else {
      result = await this.discoverFull(drive, source, workspaceId, syncRunId);
    }

    // Get and store the start page token for future incremental syncs (A-043)
    // Only update changesPageToken for full scans — selective syncs should not
    // advance the changes cursor (other files might have changed in the meantime)
    if (!shouldUseFileIdStrategy(fileIds)) {
      const startPageTokenRes = await drive.changes.getStartPageToken({});
      if (startPageTokenRes.data.startPageToken) {
        await this.sourceRepo.update(sourceId, {
          changesPageToken: startPageTokenRes.data.startPageToken,
          lastSyncedAt: new Date(),
        });
      } else {
        await this.sourceRepo.update(sourceId, {
          lastSyncedAt: new Date(),
        });
      }
    } else {
      await this.sourceRepo.update(sourceId, { lastSyncedAt: new Date() });
    }

    // Update sync run with discovered count and mark complete (A-045)
    await this.syncRunRepo.update(syncRunId, {
      discoveredCount: result.discovered,
      status: 'completed',
      finishedAt: new Date(),
    });

    this.logger.log(
      `[Discovery] Complete: source=${sourceId}, discovered=${result.discovered}, enqueued=${result.enqueued}`,
    );

    return result;
  }

  /**
   * Selective discovery — fetch only the specific file IDs provided by the user.
   * Uses drive.files.get per file instead of listing the entire Drive.
   * Skips files that are unsupported MIME types or return errors (404, etc.).
   *
   * When a folder ID is encountered, it is expanded recursively via
   * `discoverFromFolder` so that all supported files inside are enqueued.
   */
  private async discoverByFileIds(
    drive: ReturnType<typeof google.drive>,
    source: ContentSource,
    workspaceId: string,
    syncRunId: string,
    fileIds: string[],
  ): Promise<{ discovered: number; enqueued: number }> {
    this.logger.log(`[Discovery] Selective scan: ${fileIds.length} file(s) for source=${source.id}`);

    let totalEnqueued = 0;

    for (const fileId of fileIds) {
      try {
        const res = await drive.files.get({
          fileId,
          fields: 'id, name, mimeType, size',
        });

        const file = res.data;
        if (!file.id || !file.mimeType || !file.name) continue;

        // If the user selected a folder, expand its contents recursively
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          this.logger.log(`[Discovery] Expanding folder: ${file.name} (${file.id})`);
          const enqueued = await this.discoverFromFolder(drive, source, workspaceId, syncRunId, file.id);
          totalEnqueued += enqueued;
          continue;
        }

        if (!isSupportedMimeType(file.mimeType)) {
          this.logger.debug(`[Discovery] Skipping unsupported MIME: ${file.mimeType} — ${file.name}`);
          continue;
        }

        const sizeBytes = parseInt(file.size ?? '0', 10);
        await this.upsertAndEnqueue(source, workspaceId, syncRunId, file.id, file.name, file.mimeType, sizeBytes);
        totalEnqueued++;
      } catch (err) {
        // Individually failed files should not abort the whole job — log and continue
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[Discovery] Could not fetch file ${fileId}: ${message}`);
      }
    }

    return { discovered: fileIds.length, enqueued: totalEnqueued };
  }

  /**
   * Recursively list and enqueue all supported files inside a Drive folder.
   * Handles pagination and nested sub-folders.
   *
   * @returns The number of files enqueued from this folder and its descendants.
   */
  private async discoverFromFolder(
    drive: ReturnType<typeof google.drive>,
    source: ContentSource,
    workspaceId: string,
    syncRunId: string,
    folderId: string,
  ): Promise<number> {
    let enqueued = 0;
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        pageSize: 100,
        pageToken,
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
      });

      for (const file of res.data.files ?? []) {
        if (!file.id || !file.mimeType || !file.name) continue;

        // Recurse into sub-folders
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          enqueued += await this.discoverFromFolder(drive, source, workspaceId, syncRunId, file.id);
          continue;
        }

        if (!isSupportedMimeType(file.mimeType)) {
          this.logger.debug(`[Discovery] Skipping unsupported MIME: ${file.mimeType} — ${file.name}`);
          continue;
        }

        const sizeBytes = parseInt(file.size ?? '0', 10);
        await this.upsertAndEnqueue(source, workspaceId, syncRunId, file.id, file.name, file.mimeType, sizeBytes);
        enqueued++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return enqueued;
  }

  /**
   * Full discovery — list all files matching supported MIME types.
   * Used on first sync when no changesPageToken exists and no fileIds are specified.
   */
  private async discoverFull(
    drive: ReturnType<typeof google.drive>,
    source: ContentSource,
    workspaceId: string,
    syncRunId: string,
  ): Promise<{ discovered: number; enqueued: number }> {
    this.logger.log(`[Discovery] Full scan for source=${source.id}`);

    let totalDiscovered = 0;
    let totalEnqueued = 0;
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        pageSize: 100,
        pageToken,
        q: 'trashed = false',
        fields: 'nextPageToken, files(id, name, mimeType, size, parents)',
      });

      const files = res.data.files ?? [];
      totalDiscovered += files.length;

      for (const file of files) {
        if (!file.id || !file.mimeType || !file.name) continue;

        if (!isSupportedMimeType(file.mimeType)) {
          this.logger.debug(`[Discovery] Skipping unsupported MIME: ${file.mimeType} — ${file.name}`);
          continue;
        }

        const sizeBytes = parseInt(file.size ?? '0', 10);
        await this.upsertAndEnqueue(source, workspaceId, syncRunId, file.id, file.name, file.mimeType, sizeBytes);
        totalEnqueued++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return { discovered: totalDiscovered, enqueued: totalEnqueued };
  }

  /**
   * Incremental discovery (A-043) — use Drive Changes API to only
   * process files that have been added, modified, or deleted since
   * the last sync.
   *
   * Respects `source.selectedFileIds`: if the source has a specific selection,
   * only changes to those files are processed.
   */
  private async discoverChanges(
    drive: ReturnType<typeof google.drive>,
    source: ContentSource,
    workspaceId: string,
    syncRunId: string,
  ): Promise<{ discovered: number; enqueued: number }> {
    this.logger.log(`[Discovery] Incremental sync for source=${source.id} (token: ${source.changesPageToken})`);

    let totalDiscovered = 0;
    let totalEnqueued = 0;
    let pageToken = source.changesPageToken!;

    do {
      const res = await drive.changes.list({
        pageToken,
        pageSize: 100,
        fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, size, trashed))',
        includeRemoved: true,
      });

      const changes = res.data.changes ?? [];
      totalDiscovered += changes.length;

      for (const change of changes) {
        if (!change.fileId) continue;

        // Handle removed/trashed files
        if (change.removed || change.file?.trashed) {
          await this.documentRepo.update(
            { workspaceId, sourceId: source.id, externalDocumentId: change.fileId },
            { ingestStatus: 'failed', errorReason: 'FILE_REMOVED: File was deleted or trashed in Drive' },
          );
          continue;
        }

        const file = change.file;
        if (!file?.id || !file.mimeType || !file.name) continue;

        // Bug 3 fix: if the source has a specific selection, skip files outside it
        if (shouldSkipForSelection(file.id, source.selectedFileIds)) {
          this.logger.debug(`[Discovery] Skipping change for unselected file ${file.id}`);
          continue;
        }

        if (!isSupportedMimeType(file.mimeType)) continue;

        const sizeBytes = parseInt(file.size ?? '0', 10);
        await this.upsertAndEnqueue(source, workspaceId, syncRunId, file.id, file.name, file.mimeType, sizeBytes);
        totalEnqueued++;
      }

      // Use newStartPageToken for the final page, otherwise continue with nextPageToken
      if (res.data.newStartPageToken) {
        // Store updated token for the next incremental sync
        await this.sourceRepo.update(source.id, {
          changesPageToken: res.data.newStartPageToken,
        });
        break;
      }

      pageToken = res.data.nextPageToken ?? '';
    } while (pageToken);

    return { discovered: totalDiscovered, enqueued: totalEnqueued };
  }

  /**
   * Upsert a document record and enqueue a parse job.
   */
  private async upsertAndEnqueue(
    source: ContentSource,
    workspaceId: string,
    syncRunId: string,
    fileId: string,
    fileName: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<void> {
    let doc = await this.documentRepo.findOne({
      where: {
        workspaceId,
        sourceId: source.id,
        externalDocumentId: fileId,
      },
    });

    if (!doc) {
      doc = this.documentRepo.create({
        workspaceId,
        sourceId: source.id,
        externalDocumentId: fileId,
        title: fileName,
        mimeType,
        ingestStatus: 'queued',
      });
      doc = await this.documentRepo.save(doc);
    } else {
      doc.ingestStatus = 'queued';
      doc.title = fileName;
      doc.mimeType = mimeType;
      doc.errorReason = null;
      doc = await this.documentRepo.save(doc);
    }

    await this.parseQueue.add(
      'parse',
      {
        documentId: doc.id,
        workspaceId,
        sourceId: source.id,
        externalDocumentId: fileId,
        mimeType,
        title: fileName,
        sizeBytes,
        syncRunId,
        refreshTokenEnc: source.googleRefreshTokenEnc!,
      },
      {
        attempts: INGESTION_RETRY_POLICY.maxAttempts,
        backoff: {
          type: INGESTION_RETRY_POLICY.backoffType,
          delay: INGESTION_RETRY_POLICY.backoffDelay,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}

import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job, Queue } from 'bullmq';
import { google } from 'googleapis';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { decrypt, isDriveAuthFailure } from '@assistai/shared';
import { QUEUE_NAMES, EMBEDDING_CONFIG, INGESTION_RETRY_POLICY } from '@assistai/shared';
import type { ParseJobPayload, EmbedJobPayload } from '@assistai/shared';
import { Document, DocumentVersion, DocumentChunk, ContentSource } from '@assistai/entities';
import { parseDocument } from './document-parser';
import { chunkText } from './chunker';
import { MetadataExtractor } from './metadata-extractor.service';

/**
 * Parse processor (A-042, A-043, A-044, A-045, A-046).
 *
 * Downloads a file from Drive, parses it, chunks it, and stores
 * the document, version, and chunks in the database.
 *
 * Embedding generation is NOT done here — that would be a separate
 * job when the embedding endpoint is configured. For Sprint 3,
 * chunks are stored without embeddings.
 */
@Processor(QUEUE_NAMES.INGESTION_PARSE, {
  concurrency: 4,
})
export class ParseProcessor extends WorkerHost {
  private readonly logger = new Logger(ParseProcessor.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    @InjectRepository(ContentSource)
    private readonly sourceRepo: Repository<ContentSource>,
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.INGESTION_EMBED)
    private readonly embedQueue: Queue<EmbedJobPayload>,
    private readonly metadataExtractor: MetadataExtractor,
  ) {
    super();
  }

  private get encryptionKey(): string {
    return process.env.CREDENTIAL_ENCRYPTION_KEY!;
  }

  async process(job: Job<ParseJobPayload>): Promise<{ chunks: number; checksum: string }> {
    let {
      documentId,
      workspaceId,
      externalDocumentId,
      mimeType,
      title,
      sizeBytes,
      refreshTokenEnc,
      filePath,
    } = job.data;

    const maxAttempts = job.opts?.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade >= maxAttempts - 1;

    this.logger.log(`[Parse] Starting: doc=${documentId} "${title}" (attempt ${job.attemptsMade + 1}/${maxAttempts})`);

    // Update status to processing (A-046)
    await this.documentRepo.update(documentId, { ingestStatus: 'processing' });

    try {
      // Resolve Drive file metadata when mimeType is unknown (e.g. createFromDrive shortcut)
      if (!mimeType && !filePath && refreshTokenEnc) {
        const meta = await this.fetchDriveFileMetadata(refreshTokenEnc, externalDocumentId);
        mimeType = meta.mimeType;
        sizeBytes = meta.sizeBytes;
        if (!title) title = meta.name;
      }

      this.logger.log(`[Parse] Parsing: doc=${documentId} "${title}" (${mimeType})`);

      // Download file from Drive OR read from local path
      const buffer = filePath
        ? fs.readFileSync(filePath)
        : await this.downloadFromDrive(refreshTokenEnc, externalDocumentId);

      // Parse document (A-042, A-043, A-044)
      const result = await parseDocument(buffer, mimeType, sizeBytes);

      if (!result.success) {
        // Mark as failed (A-046)
        await this.documentRepo.update(documentId, {
          ingestStatus: 'failed',
          errorReason: `${result.errorCode}: ${result.errorMessage}`,
        });
        this.cleanupLocalFile(filePath);
        this.logger.warn(`[Parse] Failed: doc=${documentId} — ${result.errorCode}`);
        return { chunks: 0, checksum: '' };
      }

      const text = result.text;
      const checksum = createHash('sha256').update(text, 'utf-8').digest('hex');

      // Check if content has changed (dedup by checksum)
      const existingDoc = await this.documentRepo.findOne({ where: { id: documentId } });
      if (existingDoc?.checksum === checksum) {
        // Content unchanged — but verify embeddings exist before marking indexed.
        // If a prior run failed after chunking but before/during embedding,
        // we need to re-enqueue the embed job.
        const chunksWithoutEmbedding = await this.chunkRepo
          .createQueryBuilder('c')
          .where('c.documentId = :documentId', { documentId })
          .andWhere('c.embedding IS NULL')
          .getCount();

        if (chunksWithoutEmbedding > 0) {
          this.logger.log(
            `[Parse] Unchanged but ${chunksWithoutEmbedding} chunks lack embeddings: doc=${documentId} — re-enqueueing embed`,
          );
          await this.embedQueue.add(
            'embed',
            { documentId, workspaceId },
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
          // Keep status as processing — embed job will mark indexed
          await this.documentRepo.update(documentId, { ingestStatus: 'processing' });
          this.cleanupLocalFile(filePath);
          return { chunks: 0, checksum };
        }

        // Content unchanged and all embeddings present — skip
        await this.documentRepo.update(documentId, {
          ingestStatus: 'indexed',
          indexedAt: new Date(),
        });
        this.cleanupLocalFile(filePath);
        this.logger.log(`[Parse] Unchanged: doc=${documentId} (checksum match)`);
        return { chunks: 0, checksum };
      }

      // Chunk the text (A-050)
      const chunks = await chunkText(text);

      // Persist in a transaction (A-045)
      await this.dataSource.transaction(async (manager) => {
        // Delete old chunks for this document
        await manager.delete(DocumentChunk, { documentId });

        // Create document version (A-045)
        const versionCount = await manager.count(DocumentVersion, {
          where: { documentId },
        });
        const version = manager.create(DocumentVersion, {
          documentId,
          version: versionCount + 1,
          checksum,
          sizeBytes: String(buffer.byteLength),
        });
        await manager.save(version);

        // Store chunks (A-050, A-052 schema)
        const chunkEntities = chunks.map((chunk, index) => {
          let metadata = null;
          try {
            metadata = this.metadataExtractor.extract(chunk.content);
          } catch (err) {
            this.logger.warn(
              `[ParseProcessor] Metadata extraction failed for chunk ${index} of doc ${documentId}: ${(err as Error).message}`,
            );
          }
          return manager.create(DocumentChunk, {
            documentId,
            workspaceId,
            chunkIndex: index,
            content: chunk.content,
            tokenCount: Math.ceil(chunk.content.length / 4), // Rough estimate
            contentHash: chunk.contentHash,
            modelVersion: EMBEDDING_CONFIG.model,
            metadata,
            // embedding: null — will be filled by embedding job later
          });
        });

        // Batch insert chunks
        await manager.save(chunkEntities);

        // Update document status — chunks saved, now needs embedding
        await manager.update(Document, documentId, {
          checksum,
          ingestStatus: 'processing',
          errorReason: null,
        });
      });

      // Enqueue embedding job (A-051)
      await this.embedQueue.add(
        'embed',
        { documentId, workspaceId },
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

      // Cleanup local upload file after successful parse
      this.cleanupLocalFile(filePath);

      this.logger.log(
        `[Parse] Complete: doc=${documentId} "${title}" — ${chunks.length} chunks`,
      );

      return { chunks: chunks.length, checksum };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Detect Google auth failures and mark source as needs_reauth
      const isAuthError = isDriveAuthFailure(err);
      if (isAuthError && job.data.sourceId) {
        try {
          await this.sourceRepo.update(
            { id: job.data.sourceId },
            { status: 'needs_reauth' as any },
          );
          this.logger.warn(
            `[Parse] Drive auth failure — marked source=${job.data.sourceId} as needs_reauth`,
          );
        } catch (reauthErr) {
          this.logger.error(
            `[Parse] Failed to mark source as needs_reauth: ${(reauthErr as Error).message}`,
          );
        }
        // Auth errors are terminal — mark failed and DO NOT rethrow (prevents pointless retries)
        await this.documentRepo.update(documentId, {
          ingestStatus: 'failed',
          errorReason: `AUTH_ERROR: ${message}`,
        });
        this.cleanupLocalFile(filePath);
        this.logger.error(`[Parse] Auth failure (terminal, no retry): doc=${documentId} — ${message}`);
        return { chunks: 0, checksum: '' };
      }

      if (isFinalAttempt) {
        // Terminal failure — mark as failed (A-046)
        await this.documentRepo.update(documentId, {
          ingestStatus: 'failed',
          errorReason: `PROCESSING_ERROR: ${message}`,
        });
        // Cleanup local upload file on terminal failure
        this.cleanupLocalFile(filePath);
        this.logger.error(`[Parse] Terminal failure (attempt ${job.attemptsMade + 1}/${maxAttempts}): doc=${documentId} — ${message}`);
      } else {
        // Non-final attempt — keep in processing so UI doesn't show terminal failure
        this.logger.warn(`[Parse] Retryable failure (attempt ${job.attemptsMade + 1}/${maxAttempts}): doc=${documentId} — ${message}`);
      }

      throw err; // Re-throw for BullMQ retry
    }
  }

  /**
   * Remove a local upload file if it exists. No-op for Drive files (filePath is undefined).
   */
  private cleanupLocalFile(filePath?: string): void {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`[Parse] Cleaned up local file: ${filePath}`);
      }
    } catch (err) {
      this.logger.warn(`[Parse] Failed to cleanup file ${filePath}: ${(err as Error).message}`);
    }
  }

  /**
   * Fetch metadata (mimeType, size, name) from Google Drive for a file.
   * Used when the parse job was enqueued without metadata (e.g. createFromDrive).
   */
  private async fetchDriveFileMetadata(
    refreshTokenEnc: string,
    fileId: string,
  ): Promise<{ mimeType: string; sizeBytes: number; name: string }> {
    const refreshToken = decrypt(refreshTokenEnc, this.encryptionKey);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token for Drive metadata');
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const res = await drive.files.get({
      fileId,
      fields: 'mimeType,size,name',
    });

    return {
      mimeType: res.data.mimeType ?? '',
      sizeBytes: Number(res.data.size ?? 0),
      name: res.data.name ?? fileId,
    };
  }

  /**
   * Download a file from Google Drive using the encrypted refresh token.
   */
  private async downloadFromDrive(
    refreshTokenEnc: string,
    fileId: string,
  ): Promise<Buffer> {
    const refreshToken = decrypt(refreshTokenEnc, this.encryptionKey);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token for file download');
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    return Buffer.from(res.data as ArrayBuffer);
  }
}

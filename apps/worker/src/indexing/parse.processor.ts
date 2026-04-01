import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job, Queue } from 'bullmq';
import { google } from 'googleapis';
import { createHash } from 'node:crypto';
import { decrypt } from '@assistai/shared';
import { QUEUE_NAMES, EMBEDDING_CONFIG, INGESTION_RETRY_POLICY } from '@assistai/shared';
import type { ParseJobPayload, EmbedJobPayload } from '@assistai/shared';
import { Document, DocumentVersion, DocumentChunk } from '@assistai/entities';
import { parseDocument } from './document-parser';
import { chunkText } from './chunker';

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
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.INGESTION_EMBED)
    private readonly embedQueue: Queue<EmbedJobPayload>,
  ) {
    super();
  }

  private get encryptionKey(): string {
    return process.env.CREDENTIAL_ENCRYPTION_KEY!;
  }

  async process(job: Job<ParseJobPayload>): Promise<{ chunks: number; checksum: string }> {
    const {
      documentId,
      workspaceId,
      externalDocumentId,
      mimeType,
      title,
      sizeBytes,
      refreshTokenEnc,
    } = job.data;

    this.logger.log(`[Parse] Starting: doc=${documentId} "${title}" (${mimeType})`);

    // Update status to processing (A-046)
    await this.documentRepo.update(documentId, { ingestStatus: 'processing' });

    try {
      // Download file from Drive
      const buffer = await this.downloadFromDrive(refreshTokenEnc, externalDocumentId);

      // Parse document (A-042, A-043, A-044)
      const result = await parseDocument(buffer, mimeType, sizeBytes);

      if (!result.success) {
        // Mark as failed (A-046)
        await this.documentRepo.update(documentId, {
          ingestStatus: 'failed',
          errorReason: `${result.errorCode}: ${result.errorMessage}`,
        });
        this.logger.warn(`[Parse] Failed: doc=${documentId} — ${result.errorCode}`);
        return { chunks: 0, checksum: '' };
      }

      const text = result.text;
      const checksum = createHash('sha256').update(text, 'utf-8').digest('hex');

      // Check if content has changed (dedup by checksum)
      const existingDoc = await this.documentRepo.findOne({ where: { id: documentId } });
      if (existingDoc?.checksum === checksum) {
        // Content unchanged — skip re-chunking
        await this.documentRepo.update(documentId, {
          ingestStatus: 'indexed',
          indexedAt: new Date(),
        });
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
        const chunkEntities = chunks.map((chunk, index) =>
          manager.create(DocumentChunk, {
            documentId,
            workspaceId,
            chunkIndex: index,
            content: chunk.content,
            tokenCount: Math.ceil(chunk.content.length / 4), // Rough estimate
            contentHash: chunk.contentHash,
            modelVersion: EMBEDDING_CONFIG.model,
            // embedding: null — will be filled by embedding job later
          }),
        );

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

      this.logger.log(
        `[Parse] Complete: doc=${documentId} "${title}" — ${chunks.length} chunks`,
      );

      return { chunks: chunks.length, checksum };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Mark as failed (A-046) — BullMQ handles retries (A-047)
      await this.documentRepo.update(documentId, {
        ingestStatus: 'failed',
        errorReason: `PROCESSING_ERROR: ${message}`,
      });

      this.logger.error(`[Parse] Error: doc=${documentId} — ${message}`);
      throw err; // Re-throw for BullMQ retry
    }
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

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentChunk } from '@assistai/entities';
import type { IngestStatus } from '@assistai/entities';

export interface DeleteDocumentResult {
  id: string;
  deleted: true;
}

export interface DocTypeBreakdown {
  docType: string | null;
  count: number;
  percentage: number;
}

export interface CorpusStats {
  totalDocuments: number;
  totalChunks: number;
  docTypeBreakdown: DocTypeBreakdown[];
}

/**
 * Document service — manages document records and their indexing status (A-045, A-046).
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
  ) {}

  /**
   * Get all documents for a workspace, optionally filtered by status.
   */
  async getDocuments(
    workspaceId: string,
    status?: IngestStatus,
  ): Promise<Document[]> {
    const where: Record<string, unknown> = { workspaceId };
    if (status) {
      where.ingestStatus = status;
    }

    return this.documentRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific document by ID, scoped to workspace.
   */
  async getDocument(documentId: string, workspaceId: string): Promise<Document> {
    const doc = await this.documentRepo.findOne({
      where: { id: documentId, workspaceId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    return doc;
  }

  /**
   * Delete a document by ID, scoped to workspace.
   * Chunks are deleted automatically via ON DELETE CASCADE.
   */
  async deleteDocument(
    documentId: string,
    workspaceId: string,
  ): Promise<DeleteDocumentResult> {
    const doc = await this.documentRepo.findOne({
      where: { id: documentId, workspaceId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await this.documentRepo.remove(doc);

    this.logger.log(`[Document] Deleted doc=${documentId} workspace=${workspaceId}`);

    return { id: documentId, deleted: true };
  }

  /**
   * Get document counts by status for a workspace (A-046 UI).
   */
  async getStatusCounts(workspaceId: string): Promise<Record<IngestStatus, number>> {
    const results = await this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.ingest_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('doc.workspace_id = :workspaceId', { workspaceId })
      .groupBy('doc.ingest_status')
      .getRawMany<{ status: IngestStatus; count: string }>();

    const counts: Record<IngestStatus, number> = {
      queued: 0,
      processing: 0,
      indexed: 0,
      failed: 0,
    };

    for (const row of results) {
      if (row.status in counts) {
        counts[row.status] = parseInt(row.count, 10);
      }
    }

    return counts;
  }

  /**
   * Get corpus stats: total documents (excluding template synthetics),
   * total chunks, and breakdown by docType.
   */
  async getCorpusStats(workspaceId: string): Promise<CorpusStats> {
    // Count non-template documents that are indexed
    const totalDocuments = await this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.workspace_id = :workspaceId', { workspaceId })
      .andWhere('doc.ingest_status = :status', { status: 'indexed' })
      .andWhere(
        "(doc.external_document_id IS NULL OR doc.external_document_id NOT LIKE 'template-%')",
      )
      .getCount();

    // Chunks breakdown by docType, excluding template chunks
    const rawBreakdown = await this.chunkRepo
      .createQueryBuilder('chunk')
      .select("chunk.metadata->>'docType'", 'docType')
      .addSelect('COUNT(*)', 'count')
      .where('chunk.workspace_id = :workspaceId', { workspaceId })
      .andWhere(
        "(chunk.metadata->>'isTemplate')::boolean IS NOT TRUE",
      )
      .groupBy("chunk.metadata->>'docType'")
      .getRawMany<{ docType: string | null; count: string }>();

    const totalChunks = rawBreakdown.reduce(
      (sum, row) => sum + parseInt(row.count, 10),
      0,
    );

    const docTypeBreakdown: DocTypeBreakdown[] = rawBreakdown.map((row) => ({
      docType: row.docType,
      count: parseInt(row.count, 10),
      percentage:
        totalChunks > 0
          ? Math.round((parseInt(row.count, 10) / totalChunks) * 10000) / 100
          : 0,
    }));

    return { totalDocuments, totalChunks, docTypeBreakdown };
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '@assistai/entities';
import type { IngestStatus } from '@assistai/entities';

/**
 * Document service — manages document records and their indexing status (A-045, A-046).
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
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
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentChunk, Template } from '@assistai/entities';

export interface LibraryStatsDto {
  totalDocuments: number;
  totalChunks: number;
  totalTemplates: number;
  docTypeBreakdown: Record<string, number>;
}

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
  ) {}

  async getLibraryStats(workspaceId: string): Promise<LibraryStatsDto> {
    const [totalDocuments, totalTemplates, rawBreakdown] = await Promise.all([
      // Non-template indexed documents
      this.documentRepo
        .createQueryBuilder('doc')
        .where('doc.workspace_id = :workspaceId', { workspaceId })
        .andWhere('doc.ingest_status = :status', { status: 'indexed' })
        .andWhere(
          "(doc.external_document_id IS NULL OR doc.external_document_id NOT LIKE 'template-%')",
        )
        .getCount(),

      // Active templates for this workspace (T-7.2: filter by is_active)
      this.templateRepo
        .createQueryBuilder('tpl')
        .where('tpl.workspace_id = :workspaceId', { workspaceId })
        .andWhere('tpl.is_active = true')
        .getCount(),

      // Chunks breakdown by docType, excluding template chunks
      this.chunkRepo
        .createQueryBuilder('chunk')
        .select("chunk.metadata->>'docType'", 'docType')
        .addSelect('COUNT(*)', 'count')
        .where('chunk.workspace_id = :workspaceId', { workspaceId })
        .andWhere(
          "(chunk.metadata->>'isTemplate')::boolean IS NOT TRUE",
        )
        .groupBy("chunk.metadata->>'docType'")
        .getRawMany<{ docType: string | null; count: string }>(),
    ]);

    const totalChunks = rawBreakdown.reduce(
      (sum, row) => sum + parseInt(row.count, 10),
      0,
    );

    // Return as Record<string, number> per spec
    const docTypeBreakdown: Record<string, number> = {};
    for (const row of rawBreakdown) {
      const key = row.docType ?? 'unknown';
      docTypeBreakdown[key] = parseInt(row.count, 10);
    }

    return { totalDocuments, totalChunks, totalTemplates, docTypeBreakdown };
  }
}

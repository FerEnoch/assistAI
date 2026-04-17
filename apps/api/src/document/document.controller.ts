import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/guards';
import { DocumentService } from './document.service';
import type { IngestStatus } from '@assistai/entities';

function getWorkspaceId(req: Request): string {
  const wsId = req.session?.workspaceId;
  if (!wsId) throw new BadRequestException('No workspace in session');
  return wsId;
}

const VALID_STATUSES: IngestStatus[] = ['queued', 'processing', 'indexed', 'failed'];

/**
 * Document endpoints — query documents and their indexing status (A-046).
 */
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * GET /documents
   * List documents for the workspace, optionally filtered by status.
   */
  @Get()
  @UseGuards(SessionGuard)
  async listDocuments(
    @Query('status') status: string | undefined,
    @Req() req: Request,
  ) {
    const wsId = getWorkspaceId(req);
    let ingestStatus: IngestStatus | undefined;

    if (status) {
      if (!VALID_STATUSES.includes(status as IngestStatus)) {
        throw new BadRequestException(
          `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        );
      }
      ingestStatus = status as IngestStatus;
    }

    return this.documentService.getDocuments(wsId, ingestStatus);
  }

  /**
   * GET /documents/stats
   * Get corpus statistics for the workspace.
   */
  @Get('stats')
  @UseGuards(SessionGuard)
  async getCorpusStats(@Req() req: Request) {
    return this.documentService.getCorpusStats(getWorkspaceId(req));
  }

  /**
   * GET /documents/status-counts
   * Get counts by indexing status for the workspace.
   */
  @Get('status-counts')
  @UseGuards(SessionGuard)
  async getStatusCounts(@Req() req: Request) {
    return this.documentService.getStatusCounts(getWorkspaceId(req));
  }

  /**
   * GET /documents/:id
   * Get a specific document.
   */
  @Get(':id')
  @UseGuards(SessionGuard)
  async getDocument(@Param('id') id: string, @Req() req: Request) {
    return this.documentService.getDocument(id, getWorkspaceId(req));
  }

  /**
   * DELETE /documents/:id
   * Delete a document and its chunks (via CASCADE) for the workspace.
   * Works regardless of ingest status — queued, processing, indexed, or failed.
   */
  @Delete(':id')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async deleteDocument(@Param('id') id: string, @Req() req: Request) {
    return this.documentService.deleteDocument(id, getWorkspaceId(req));
  }
}

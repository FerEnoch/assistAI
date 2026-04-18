import { Controller, Get, Req, UseGuards, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/guards';
import { LibraryService } from './library.service';

function getWorkspaceId(req: Request): string {
  const wsId = req.session?.workspaceId;
  if (!wsId) throw new BadRequestException('No workspace in session');
  return wsId;
}

@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  /**
   * GET /library/stats
   * Returns aggregated stats for the workspace library:
   * totalDocuments, totalChunks, totalTemplates, docTypeBreakdown.
   */
  @Get('stats')
  @UseGuards(SessionGuard)
  async getStats(@Req() req: Request) {
    return this.libraryService.getLibraryStats(getWorkspaceId(req));
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Workspace,
  User,
  ContentSource,
  Document,
  DocumentVersion,
  DocumentChunk,
  EditorSession,
  CompletionRequest,
  CompletionRetrievalHit,
  ModelEndpoint,
  WorkspaceMember,
} from '@assistai/entities';

/**
 * Workspace deletion service (A-094).
 *
 * Implements cascading deletion of all workspace data:
 * 1. Completion retrieval hits
 * 2. Completion requests
 * 3. Editor sessions
 * 4. Document chunks (including embeddings)
 * 5. Document versions
 * 6. Documents
 * 7. Source sync runs
 * 8. Content sources
 * 9. Model endpoints
 * 10. Workspace members
 * 11. Workspace
 *
 * All deletions run in a single transaction for atomicity.
 * Audit log entry created before deletion.
 */
@Injectable()
export class DeletionService {
  private readonly logger = new Logger(DeletionService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Delete all data for a workspace (A-094 — GDPR right to erasure).
   *
   * This is a DESTRUCTIVE operation. All workspace data is permanently removed.
   * Returns a summary of what was deleted for audit purposes.
   */
  async deleteWorkspace(
    workspaceId: string,
    requestedByUserId: string,
  ): Promise<{
    workspaceId: string;
    deletedAt: string;
    requestedBy: string;
    counts: Record<string, number>;
  }> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace no encontrado');
    }

    this.logger.warn({
      msg: '[Deletion] Starting workspace deletion',
      workspaceId,
      requestedBy: requestedByUserId,
    });

    const counts: Record<string, number> = {};

    await this.dataSource.transaction(async (manager) => {
      // 1. Completion retrieval hits (via completion requests)
      const hitResult = await manager
        .createQueryBuilder()
        .delete()
        .from(CompletionRetrievalHit)
        .where(
          'completionRequestId IN (SELECT id FROM completion_request WHERE "workspaceId" = :workspaceId)',
          { workspaceId },
        )
        .execute();
      counts.completionRetrievalHits = hitResult.affected ?? 0;

      // 2. Completion requests
      const crResult = await manager.delete(CompletionRequest, { workspaceId });
      counts.completionRequests = crResult.affected ?? 0;

      // 3. Editor sessions
      const esResult = await manager.delete(EditorSession, { workspaceId });
      counts.editorSessions = esResult.affected ?? 0;

      // 4. Document chunks (via documents)
      const chunkResult = await manager
        .createQueryBuilder()
        .delete()
        .from(DocumentChunk)
        .where(
          '"documentId" IN (SELECT id FROM document WHERE "workspaceId" = :workspaceId)',
          { workspaceId },
        )
        .execute();
      counts.documentChunks = chunkResult.affected ?? 0;

      // 5. Document versions (via documents)
      const versionResult = await manager
        .createQueryBuilder()
        .delete()
        .from(DocumentVersion)
        .where(
          '"documentId" IN (SELECT id FROM document WHERE "workspaceId" = :workspaceId)',
          { workspaceId },
        )
        .execute();
      counts.documentVersions = versionResult.affected ?? 0;

      // 6. Documents
      const docResult = await manager.delete(Document, { workspaceId });
      counts.documents = docResult.affected ?? 0;

      // 7. Content sources (sync runs cascade via DB FK)
      const sourceResult = await manager.delete(ContentSource, { workspaceId });
      counts.contentSources = sourceResult.affected ?? 0;

      // 8. Model endpoints
      const endpointResult = await manager.delete(ModelEndpoint, { workspaceId });
      counts.modelEndpoints = endpointResult.affected ?? 0;

      // 9. Workspace members
      const memberResult = await manager.delete(WorkspaceMember, { workspaceId });
      counts.workspaceMembers = memberResult.affected ?? 0;

      // 10. Workspace
      await manager.delete(Workspace, { id: workspaceId });
      counts.workspace = 1;
    });

    const result = {
      workspaceId,
      deletedAt: new Date().toISOString(),
      requestedBy: requestedByUserId,
      counts,
    };

    this.logger.warn({
      msg: '[Deletion] Workspace deletion complete',
      ...result,
    });

    return result;
  }

  /**
   * Delete a user account and all associated data (A-094).
   *
   * Deletes all workspaces the user owns, then the user record.
   */
  async deleteUserAccount(
    userId: string,
  ): Promise<{
    userId: string;
    deletedAt: string;
    workspacesDeleted: number;
  }> {
    this.logger.warn({
      msg: '[Deletion] Starting user account deletion',
      userId,
    });

    // Find all workspaces the user owns
    const ownedWorkspaces = await this.dataSource.manager.find(WorkspaceMember, {
      where: { userId, role: 'owner' },
    });

    let workspacesDeleted = 0;
    for (const membership of ownedWorkspaces) {
      await this.deleteWorkspace(membership.workspaceId, userId);
      workspacesDeleted++;
    }

    // Remove any remaining memberships (non-owner)
    await this.dataSource.manager.delete(WorkspaceMember, { userId });

    // Delete user record
    await this.dataSource.manager.delete(User, { id: userId });

    this.logger.warn({
      msg: '[Deletion] User account deletion complete',
      userId,
      workspacesDeleted,
    });

    return {
      userId,
      deletedAt: new Date().toISOString(),
      workspacesDeleted,
    };
  }
}

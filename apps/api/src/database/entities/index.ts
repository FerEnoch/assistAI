// Re-export all entities from the shared @assistai/entities package
// This barrel exists for backward compatibility with existing database/index.ts imports
export {
  User,
  Workspace,
  WorkspaceMember,
  ContentSource,
  SourceSyncRun,
  Document,
  DocumentVersion,
  DocumentChunk,
} from '@assistai/entities';
export type { IngestStatus } from '@assistai/entities';

/**
 * Supported MIME types for document ingestion (A-041).
 * Only these types will be processed; all others are rejected.
 */
export const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/pdf',
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * File size limits per MIME type in bytes (A-041).
 * These are conservative limits for an MVP to prevent OOM during parsing.
 */
export const FILE_SIZE_LIMITS: Record<SupportedMimeType, number> = {
  'text/plain': 10 * 1024 * 1024,          // 10 MB
  'text/markdown': 10 * 1024 * 1024,       // 10 MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 50 * 1024 * 1024,  // 50 MB
  'application/pdf': 50 * 1024 * 1024,     // 50 MB
};

/**
 * Check if a MIME type is supported for ingestion.
 */
export function isSupportedMimeType(mimeType: string): mimeType is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a file is within size limits for its MIME type.
 * Returns the limit in bytes if exceeded, or null if within limits.
 */
export function checkFileSizeLimit(
  mimeType: SupportedMimeType,
  sizeBytes: number,
): { exceeded: boolean; limitBytes: number } {
  const limit = FILE_SIZE_LIMITS[mimeType];
  return { exceeded: sizeBytes > limit, limitBytes: limit };
}

/**
 * Ingestion job payload types.
 */
export interface DiscoveryJobPayload {
  sourceId: string;
  workspaceId: string;
  syncRunId: string;
  /**
   * When present, only these Drive file IDs will be indexed.
   * Undefined or empty array means "full scan" — index everything accessible.
   */
  fileIds?: string[];
}

export interface ParseJobPayload {
  documentId: string;
  workspaceId: string;
  sourceId: string;
  externalDocumentId: string;
  mimeType: string;
  title: string;
  sizeBytes: number;
  syncRunId: string;
  /** Encrypted refresh token for Drive API access */
  refreshTokenEnc: string;
}

export interface EmbedJobPayload {
  documentId: string;
  workspaceId: string;
}

/**
 * Retry policy constants for transient failures (A-047).
 */
export const INGESTION_RETRY_POLICY = {
  /** Maximum number of retry attempts */
  maxAttempts: 3,
  /** Initial backoff delay in ms (exponential: 5s, 25s, 125s) */
  backoffDelay: 5_000,
  /** Backoff type */
  backoffType: 'exponential' as const,
} as const;

/**
 * Chunking configuration for Spanish text (A-050).
 * RecursiveCharacterTextSplitter from @langchain/textsplitters.
 */
export const CHUNKING_CONFIG = {
  chunkSize: 1500,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', ';\n', '; ', ', ', ' '],
} as const;

/**
 * Embedding model configuration (backlog §2.5).
 */
export const EMBEDDING_CONFIG = {
  model: 'qwen/qwen3-embedding-8b',
  dimensions: 1024,
} as const;

/**
 * Queue names used across API and Worker.
 * Centralized here to avoid typo-related bugs.
 */
export const QUEUE_NAMES = {
  TEST: 'test-queue',
  INGESTION_DISCOVERY: 'ingestion-discovery',
  INGESTION_PARSE: 'ingestion-parse',
  INGESTION_EMBED: 'ingestion-embed',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

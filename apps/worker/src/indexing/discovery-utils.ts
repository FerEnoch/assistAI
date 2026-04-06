/**
 * Pure utility functions for the discovery processor.
 * Extracted for testability — these contain no I/O.
 */

/**
 * Returns true when a specific set of file IDs should be used for discovery
 * instead of a full Drive scan.
 */
export function shouldUseFileIdStrategy(fileIds?: string[]): boolean {
  return Array.isArray(fileIds) && fileIds.length > 0;
}

/**
 * Returns true when a file should be skipped because it is not in the
 * user's explicit selection.
 *
 * When `selectedFileIds` is null/undefined/empty, no filtering applies
 * (full scan mode — process all files).
 *
 * @param fileId          - The Drive file ID being evaluated
 * @param selectedFileIds - The persisted selection from content_sources, or null
 */
export function shouldSkipForSelection(
  fileId: string,
  selectedFileIds?: string[] | null,
): boolean {
  if (!selectedFileIds?.length) return false;
  return !selectedFileIds.includes(fileId);
}

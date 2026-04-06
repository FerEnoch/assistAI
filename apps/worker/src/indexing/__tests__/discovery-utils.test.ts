import { describe, it, expect } from 'vitest';
import { shouldUseFileIdStrategy, shouldSkipForSelection } from '../discovery-utils';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for discovery-utils pure functions (Bug 1 — selective indexing)
//
// shouldUseFileIdStrategy: decides whether to use per-file fetch vs full scan
// shouldSkipForSelection: decides whether a change event should be ignored
//   during incremental sync when the source has a specific file selection
// ─────────────────────────────────────────────────────────────────────────────

describe('shouldUseFileIdStrategy', () => {
  it('returns true when fileIds is a non-empty array', () => {
    expect(shouldUseFileIdStrategy(['file-1', 'file-2'])).toBe(true);
  });

  it('returns true for a single file ID', () => {
    expect(shouldUseFileIdStrategy(['file-1'])).toBe(true);
  });

  it('returns false when fileIds is undefined', () => {
    expect(shouldUseFileIdStrategy(undefined)).toBe(false);
  });

  it('returns false when fileIds is an empty array', () => {
    expect(shouldUseFileIdStrategy([])).toBe(false);
  });
});

describe('shouldSkipForSelection', () => {
  it('returns false when selectedFileIds is null (full scan mode)', () => {
    expect(shouldSkipForSelection('file-abc', null)).toBe(false);
  });

  it('returns false when selectedFileIds is undefined', () => {
    expect(shouldSkipForSelection('file-abc', undefined)).toBe(false);
  });

  it('returns false when selectedFileIds is an empty array', () => {
    expect(shouldSkipForSelection('file-abc', [])).toBe(false);
  });

  it('returns false when the fileId IS in selectedFileIds', () => {
    expect(shouldSkipForSelection('file-abc', ['file-abc', 'file-xyz'])).toBe(false);
  });

  it('returns true when the fileId is NOT in selectedFileIds', () => {
    expect(shouldSkipForSelection('file-other', ['file-abc', 'file-xyz'])).toBe(true);
  });

  it('returns true when selectedFileIds has one entry and it does not match', () => {
    expect(shouldSkipForSelection('file-nope', ['file-abc'])).toBe(true);
  });

  it('is case-sensitive on file IDs', () => {
    // Drive file IDs are case-sensitive
    expect(shouldSkipForSelection('File-ABC', ['file-abc'])).toBe(true);
  });
});

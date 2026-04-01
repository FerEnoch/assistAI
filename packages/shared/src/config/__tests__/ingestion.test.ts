import { describe, it, expect } from 'vitest';
import {
  isSupportedMimeType,
  checkFileSizeLimit,
  SUPPORTED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  CHUNKING_CONFIG,
  EMBEDDING_CONFIG,
  INGESTION_RETRY_POLICY,
} from '../ingestion';

describe('Ingestion Constants', () => {
  describe('SUPPORTED_MIME_TYPES', () => {
    it('should include TXT, Markdown, DOCX, and PDF', () => {
      expect(SUPPORTED_MIME_TYPES).toContain('text/plain');
      expect(SUPPORTED_MIME_TYPES).toContain('text/markdown');
      expect(SUPPORTED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(SUPPORTED_MIME_TYPES).toContain('application/pdf');
      expect(SUPPORTED_MIME_TYPES).toHaveLength(4);
    });
  });

  describe('isSupportedMimeType', () => {
    it('should return true for supported types', () => {
      expect(isSupportedMimeType('text/plain')).toBe(true);
      expect(isSupportedMimeType('application/pdf')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(isSupportedMimeType('image/png')).toBe(false);
      expect(isSupportedMimeType('application/json')).toBe(false);
      expect(isSupportedMimeType('video/mp4')).toBe(false);
    });
  });

  describe('checkFileSizeLimit', () => {
    it('should pass for files within limits', () => {
      const result = checkFileSizeLimit('text/plain', 1024);
      expect(result.exceeded).toBe(false);
    });

    it('should fail for files exceeding limits', () => {
      const result = checkFileSizeLimit('text/plain', 100 * 1024 * 1024);
      expect(result.exceeded).toBe(true);
      expect(result.limitBytes).toBe(FILE_SIZE_LIMITS['text/plain']);
    });

    it('should have correct limits for DOCX (50MB)', () => {
      const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const;
      const result = checkFileSizeLimit(mime, 51 * 1024 * 1024);
      expect(result.exceeded).toBe(true);
      expect(result.limitBytes).toBe(50 * 1024 * 1024);
    });
  });

  describe('CHUNKING_CONFIG', () => {
    it('should use 1500 char chunks with 200 overlap per backlog', () => {
      expect(CHUNKING_CONFIG.chunkSize).toBe(1500);
      expect(CHUNKING_CONFIG.chunkOverlap).toBe(200);
    });

    it('should have Spanish-tuned separators including semicolons', () => {
      expect(CHUNKING_CONFIG.separators).toContain(';\n');
      expect(CHUNKING_CONFIG.separators).toContain('; ');
      expect(CHUNKING_CONFIG.separators).toContain('. ');
    });
  });

  describe('EMBEDDING_CONFIG', () => {
    it('should use text-embedding-3-small with 1024 dimensions', () => {
      expect(EMBEDDING_CONFIG.model).toBe('text-embedding-3-small');
      expect(EMBEDDING_CONFIG.dimensions).toBe(1024);
    });
  });

  describe('INGESTION_RETRY_POLICY', () => {
    it('should have 3 max attempts with exponential backoff', () => {
      expect(INGESTION_RETRY_POLICY.maxAttempts).toBe(3);
      expect(INGESTION_RETRY_POLICY.backoffType).toBe('exponential');
      expect(INGESTION_RETRY_POLICY.backoffDelay).toBe(5000);
    });
  });
});

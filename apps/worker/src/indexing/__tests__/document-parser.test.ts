import { describe, it, expect } from 'vitest';
import { parseDocument } from '../document-parser';

describe('Document Parser — MIME filtering and routing (A-041)', () => {
  it('should reject unsupported MIME types', async () => {
    const buffer = Buffer.from('some content');
    const result = await parseDocument(buffer, 'image/png', 100);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('INVALID_MIME_TYPE');
      expect(result.errorMessage).toContain('image/png');
    }
  });

  it('should reject files exceeding size limits', async () => {
    const buffer = Buffer.from('x');
    // 100MB exceeds 10MB TXT limit
    const result = await parseDocument(buffer, 'text/plain', 100 * 1024 * 1024);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    }
  });

  it('should parse TXT files successfully', async () => {
    const content = 'Artículo 1. Disposiciones generales del contrato.';
    const buffer = Buffer.from(content, 'utf-8');
    const result = await parseDocument(buffer, 'text/plain', buffer.length);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.text).toBe(content);
    }
  });

  it('should parse Markdown files successfully', async () => {
    const content = '# Título del Documento\n\nContenido legal.';
    const buffer = Buffer.from(content, 'utf-8');
    const result = await parseDocument(buffer, 'text/markdown', buffer.length);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.text).toBe(content);
    }
  });

  it('should return EMPTY_CONTENT for empty files', async () => {
    const buffer = Buffer.from('   \n\n  ', 'utf-8');
    const result = await parseDocument(buffer, 'text/plain', buffer.length);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('EMPTY_CONTENT');
    }
  });

  it('should reject application/json', async () => {
    const buffer = Buffer.from('{"key": "value"}');
    const result = await parseDocument(buffer, 'application/json', buffer.length);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('INVALID_MIME_TYPE');
    }
  });
});

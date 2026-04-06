import { describe, it, expect } from 'vitest';
import { sanitizePdfText } from '../parsers/pdf-parser';

// ──────────────────────────────────────────────────────────────────────────────
// Tests for sanitizePdfText (Bug 2 — invalid byte sequence 0x00 in PostgreSQL)
//
// PostgreSQL text columns reject the null byte (\x00 / U+0000). pdfjs-dist can
// produce null bytes from PDFs with empty form fields, corrupted streams, or
// certain font encodings. We sanitize them at extraction time.
//
// parsePdf itself requires a real PDF buffer + pdfjs-dist — not tested here.
// sanitizePdfText is the pure function we can unit-test directly.
// ──────────────────────────────────────────────────────────────────────────────

describe('sanitizePdfText', () => {
  it('removes a null byte embedded in text', () => {
    expect(sanitizePdfText('hola\x00mundo')).toBe('holamundo');
  });

  it('removes multiple null bytes', () => {
    expect(sanitizePdfText('\x00texto\x00con\x00varios\x00')).toBe('textoconvarios');
  });

  it('removes consecutive null bytes', () => {
    expect(sanitizePdfText('a\x00\x00\x00b')).toBe('ab');
  });

  it('returns unchanged string when no null bytes are present', () => {
    const clean = 'Según el artículo primero del contrato, las partes acuerdan.';
    expect(sanitizePdfText(clean)).toBe(clean);
  });

  it('handles empty string', () => {
    expect(sanitizePdfText('')).toBe('');
  });

  it('handles string consisting entirely of null bytes', () => {
    expect(sanitizePdfText('\x00\x00\x00')).toBe('');
  });

  it('preserves newlines, tabs, and non-ASCII chars (Spanish)', () => {
    const text = 'línea uno\n\tlínea dos\r\nfin';
    expect(sanitizePdfText(text)).toBe(text);
  });

  it('handles null bytes at start and end', () => {
    expect(sanitizePdfText('\x00contenido\x00')).toBe('contenido');
  });
});

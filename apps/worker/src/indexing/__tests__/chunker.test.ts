import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunker';

describe('Chunker — Spanish text splitting (A-050)', () => {
  it('should chunk a long text into multiple chunks', async () => {
    // Create a text that is longer than 1500 chars
    const paragraph = 'Según el artículo primero del presente contrato, las partes acuerdan las siguientes disposiciones. ';
    const longText = paragraph.repeat(30); // ~3000 chars

    const chunks = await chunkText(longText);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length > 0)).toBe(true);
    expect(chunks.every((c) => c.contentHash.length === 32)).toBe(true);
  });

  it('should not split a short text', async () => {
    const shortText = 'Este es un texto corto que no necesita ser dividido.';

    const chunks = await chunkText(shortText);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(shortText);
  });

  it('should respect paragraph separators', async () => {
    const text = 'Párrafo primero con contenido legal extenso y detallado.\n\n'
      + 'a'.repeat(1400) + '\n\n'
      + 'Párrafo tercero después de la separación.';

    const chunks = await chunkText(text);

    // Should split at the paragraph boundary
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('should generate content hashes for deduplication', async () => {
    const text = 'Contenido de prueba para verificar el hash.';
    const chunks1 = await chunkText(text);
    const chunks2 = await chunkText(text);

    // Same content should produce same hash
    expect(chunks1[0].contentHash).toBe(chunks2[0].contentHash);
  });

  it('should handle Spanish legal clause separators (;\\n)', async () => {
    const clauses = Array.from({ length: 20 }, (_, i) =>
      `Cláusula ${i + 1}: El arrendatario se compromete a cumplir con las disposiciones establecidas en el presente documento legal`
    ).join(';\n');

    const chunks = await chunkText(clauses);

    // Should have split at ;\n boundaries
    expect(chunks.length).toBeGreaterThan(1);
    // No chunk should be empty
    expect(chunks.every((c) => c.content.trim().length > 0)).toBe(true);
  });

  it('should produce chunks within size limits', async () => {
    const paragraph = 'La presente disposición legal establece que las partes contratantes deberán observar las siguientes obligaciones y derechos. ';
    const longText = paragraph.repeat(100);

    const chunks = await chunkText(longText);

    // Chunks should not exceed chunkSize by much (some tolerance for splitter behavior)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(1600); // 1500 + tolerance
    }
  });

  // ── Bug 2 regression: null bytes (\x00) must be stripped before chunking ──
  it('strips null bytes before chunking (defensive sanitization)', async () => {
    const textWithNulls = 'contenido\x00con\x00bytes\x00nulos';
    const chunks = await chunkText(textWithNulls);

    expect(chunks.every((c) => !c.content.includes('\x00'))).toBe(true);
  });

  it('strips null bytes and preserves meaningful content', async () => {
    const textWithNulls = 'Cláusula 1\x00: El contrato establece obligaciones.';
    const chunks = await chunkText(textWithNulls);

    expect(chunks[0].content).toBe('Cláusula 1: El contrato establece obligaciones.');
  });

  it('returns empty array when text is only null bytes', async () => {
    const chunks = await chunkText('\x00\x00\x00');
    expect(chunks).toHaveLength(0);
  });
});

/**
 * Integration test — parse real PDF files from test-files/.
 *
 * This test runs against actual PDF buffers (no mocks) to verify:
 * 1. parsePdf extracts text without crashing
 * 2. sanitizePdfText removes null bytes (Bug 2 regression)
 * 3. chunkText produces valid chunks with no null bytes
 *
 * Run manually:
 *   pnpm --filter worker exec vitest run src/indexing/__tests__/pdf-integration.test.ts
 *
 * Files expected (placed by developer, not committed):
 *   apps/worker/test-files/ciencia_abierta.pdf
 *   apps/worker/test-files/SoftwareLibre_EconomiaSocial.pdf
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePdf, sanitizePdfText } from '../parsers/pdf-parser';
import { chunkText } from '../chunker';
import { parseDocument } from '../document-parser';

// Resolve from worker package root → test-files/
const TEST_FILES_DIR = resolve(__dirname, '../../../test-files');

function testFilePath(name: string): string {
  return resolve(TEST_FILES_DIR, name);
}

const PDF_FILES = [
  'ciencia_abierta.pdf',
  'SoftwareLibre_EconomiaSocial.pdf',
];

describe('PDF integration — real files', () => {
  for (const filename of PDF_FILES) {
    const filePath = testFilePath(filename);

    // Skip gracefully if file is not present
    if (!existsSync(filePath)) {
      it.skip(`${filename} — archivo no encontrado en test-files/`, () => {});
      continue;
    }

    describe(filename, () => {
      let buffer: Buffer;
      let rawText: string;

      it('reads the file buffer without error', () => {
        buffer = readFileSync(filePath);
        expect(buffer.byteLength).toBeGreaterThan(0);
      });

      it('parsePdf extracts non-empty text', async () => {
        buffer = readFileSync(filePath);
        rawText = await parsePdf(buffer);

        console.log(`\n[${filename}] Extracted ${rawText.length} chars, first 200:\n${rawText.slice(0, 200)}`);

        expect(rawText.length).toBeGreaterThan(0);
      });

      it('extracted text contains no null bytes (Bug 2 regression)', async () => {
        buffer = readFileSync(filePath);
        rawText = await parsePdf(buffer);

        const nullByteCount = (rawText.match(/\x00/g) ?? []).length;
        if (nullByteCount > 0) {
          console.warn(`  ⚠ Found ${nullByteCount} null bytes BEFORE sanitizePdfText — they should have been removed by parsePdf`);
        }

        expect(nullByteCount).toBe(0);
      });

      it('parseDocument pipeline returns success=true', async () => {
        buffer = readFileSync(filePath);
        const sizeBytes = buffer.byteLength;
        const result = await parseDocument(buffer, 'application/pdf', sizeBytes);

        if (!result.success) {
          console.error(`  ✗ parseDocument failed: [${result.errorCode}] ${result.errorMessage}`);
        }

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.text.length).toBeGreaterThan(0);
          expect(result.text).not.toContain('\x00');
        }
      });

      it('chunkText produces valid chunks with no null bytes', async () => {
        buffer = readFileSync(filePath);
        rawText = await parsePdf(buffer);
        const chunks = await chunkText(rawText);

        console.log(`  → ${chunks.length} chunks produced`);
        if (chunks.length > 0) {
          console.log(`  → First chunk preview: ${chunks[0].content.slice(0, 120)}`);
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.every((c) => c.content.length > 0)).toBe(true);
        expect(chunks.every((c) => !c.content.includes('\x00'))).toBe(true);
        expect(chunks.every((c) => c.contentHash.length === 32)).toBe(true);
      });

      it('sanitizePdfText is idempotent on already-clean output', async () => {
        buffer = readFileSync(filePath);
        rawText = await parsePdf(buffer);
        const doubleSanitized = sanitizePdfText(rawText);

        // parsePdf already sanitizes — running it again should produce same result
        expect(doubleSanitized).toBe(rawText);
      });
    });
  }
});

/**
 * PDF text extraction using pdfjs-dist@^4 per backlog §2.5 (A-044).
 *
 * NOT pdf-parse — the backlog explicitly requires pdfjs-dist.
 * We import the Node.js build which doesn't need a canvas.
 */

// pdfjs-dist v4 ESM build for Node.js
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Sanitize text extracted from a PDF by removing characters that PostgreSQL
 * rejects in UTF-8 text columns.
 *
 * The null byte (\x00 / U+0000) is the most common offender — pdfjs-dist can
 * produce it from PDFs with empty form fields, corrupted streams, or certain
 * encodings. PostgreSQL's `text` type explicitly forbids it.
 */
export function sanitizePdfText(raw: string): string {
  return raw.replace(/\x00/g, '');
}

/**
 * Extract text content from a PDF buffer.
 * Concatenates text from all pages, separated by double newlines.
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  // Convert Buffer to Uint8Array for pdfjs-dist
  const data = new Uint8Array(buffer);

  const doc: PDFDocumentProxy = await getDocument({
    data,
    // Disable font/image loading — we only need text
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    // Join text items, respecting line breaks from `hasEOL`
    const pageText = textContent.items
      .filter((item) => 'str' in item)
      .map((item) => {
        const textItem = item as { str: string; hasEOL?: boolean };
        return textItem.str + (textItem.hasEOL ? '\n' : '');
      })
      .join('')
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  await doc.destroy();

  return sanitizePdfText(pages.join('\n\n').trim());
}

import mammoth from 'mammoth';

/**
 * DOCX parser using mammoth@^1.8 per backlog §2.5 (A-043).
 * Extracts raw text preserving basic structure (paragraphs, lists).
 */
export async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    // Log warnings but don't fail — partial extraction is acceptable
    const warnings = result.messages
      .filter((m) => m.type === 'warning')
      .map((m) => m.message);
    if (warnings.length > 0) {
      console.warn(`[DOCX parser] Warnings: ${warnings.join('; ')}`);
    }
  }

  return result.value.trim();
}

/**
 * TXT and Markdown parser (A-042).
 * Direct text extraction — no library needed.
 */
export function parseTxt(buffer: Buffer): string {
  return buffer.toString('utf-8').trim();
}

/**
 * Markdown is treated identically to TXT for embedding purposes.
 * We keep the markdown formatting as-is since the embeddings model
 * handles structure reasonably and legal documents use simple formatting.
 */
export const parseMarkdown = parseTxt;

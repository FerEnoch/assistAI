import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createHash } from 'node:crypto';
import { CHUNKING_CONFIG } from '@assistai/shared';

/**
 * Chunk a document's text content using RecursiveCharacterTextSplitter (A-050).
 *
 * Configured for Spanish legal text:
 * - 1500 chars per chunk
 * - 200 char overlap for context continuity
 * - Separators tuned for Spanish punctuation ("; " after legal clauses)
 *
 * @returns Array of chunks with content and content hash for dedup
 */
export async function chunkText(text: string): Promise<Array<{ content: string; contentHash: string }>> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNKING_CONFIG.chunkSize,
    chunkOverlap: CHUNKING_CONFIG.chunkOverlap,
    separators: [...CHUNKING_CONFIG.separators],
  });

  const chunks = await splitter.splitText(text);

  return chunks.map((content) => ({
    content,
    contentHash: createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 32),
  }));
}

import { isSupportedMimeType, checkFileSizeLimit } from '@assistai/shared';
import type { SupportedMimeType } from '@assistai/shared';
import { parseTxt, parseMarkdown, parseDocx, parsePdf } from './parsers';

/**
 * Result of a document parse operation.
 */
export interface ParseResult {
  success: true;
  text: string;
}

export interface ParseError {
  success: false;
  errorCode: 'INVALID_MIME_TYPE' | 'FILE_TOO_LARGE' | 'PARSE_FAILED' | 'EMPTY_CONTENT';
  errorMessage: string;
}

export type ParseOutcome = ParseResult | ParseError;

/**
 * Route a file buffer to the correct parser based on MIME type.
 * Enforces MIME filtering (A-041) and size limits before parsing.
 *
 * @param buffer - Raw file content
 * @param mimeType - MIME type from Drive metadata
 * @param sizeBytes - File size in bytes
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  sizeBytes: number,
): Promise<ParseOutcome> {
  // A-041: MIME filtering
  if (!isSupportedMimeType(mimeType)) {
    return {
      success: false,
      errorCode: 'INVALID_MIME_TYPE',
      errorMessage: `Unsupported MIME type: ${mimeType}. Supported: TXT, Markdown, DOCX, PDF`,
    };
  }

  // A-041: File size limits
  const sizeCheck = checkFileSizeLimit(mimeType, sizeBytes);
  if (sizeCheck.exceeded) {
    return {
      success: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `File exceeds size limit of ${Math.round(sizeCheck.limitBytes / 1024 / 1024)}MB`,
    };
  }

  try {
    let text: string;

    switch (mimeType as SupportedMimeType) {
      case 'text/plain':
        text = parseTxt(buffer);
        break;
      case 'text/markdown':
        text = parseMarkdown(buffer);
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        text = await parseDocx(buffer);
        break;
      case 'application/pdf':
        text = await parsePdf(buffer);
        break;
      default:
        return {
          success: false,
          errorCode: 'INVALID_MIME_TYPE',
          errorMessage: `No parser for MIME type: ${mimeType}`,
        };
    }

    if (!text || text.length === 0) {
      return {
        success: false,
        errorCode: 'EMPTY_CONTENT',
        errorMessage: 'Document parsed but contained no text content',
      };
    }

    return { success: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errorCode: 'PARSE_FAILED',
      errorMessage: `Parse error: ${message}`,
    };
  }
}

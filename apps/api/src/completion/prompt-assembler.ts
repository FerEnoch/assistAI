import { Injectable, Logger } from '@nestjs/common';
import { COMPLETION_CONFIG } from '@assistai/shared';
import type { RetrievalHit } from '@assistai/shared';

/**
 * Prompt assembly service — builds the LLM prompt with evidence injection (A-072).
 *
 * Responsibilities:
 * - Truncates prefix to maxPrefixChars
 * - Formats retrieval evidence into a coherent context block
 * - Applies the retrieval gating heuristic (A-071)
 * - Returns a structured prompt ready for the LLM
 */
@Injectable()
export class PromptAssembler {
  private readonly logger = new Logger(PromptAssembler.name);

  /**
   * Determine if retrieval should be skipped based on the gating heuristic (A-071).
   *
   * Skip retrieval for:
   * - Very short prefix text (< retrievalGateMinChars)
   *   → user is just starting, retrieval adds latency without value
   */
  shouldSkipRetrieval(prefix: string): boolean {
    const trimmed = prefix.trim();
    const skip = trimmed.length < COMPLETION_CONFIG.retrievalGateMinChars;

    if (skip) {
      this.logger.debug(
        `[Prompt] Skipping retrieval: prefix length ${trimmed.length} < threshold ${COMPLETION_CONFIG.retrievalGateMinChars}`,
      );
    }

    return skip;
  }

  /**
   * Assemble the full prompt for the LLM completion request (A-072).
   *
   * @param prefix - Text before the cursor
   * @param evidence - Retrieval hits (may be empty if gated out)
   * @returns Messages array for chat completion API
   */
  assemblePrompt(
    prefix: string,
    evidence: RetrievalHit[],
  ): { system: string; user: string } {
    // Truncate prefix to max chars (take the TAIL — most recent context)
    const truncatedPrefix = prefix.length > COMPLETION_CONFIG.maxPrefixChars
      ? prefix.slice(-COMPLETION_CONFIG.maxPrefixChars)
      : prefix;

    // Build system prompt with evidence if available
    let system = COMPLETION_CONFIG.systemPrompt;

    if (evidence.length > 0) {
      const chunksText = evidence
        .map((hit, i) => {
          const source = hit.documentTitle ?? 'Documento';
          const sim = (hit.similarity * 100).toFixed(0);
          return `[${i + 1}] (${source}, relevancia: ${sim}%)\n${hit.content}`;
        })
        .join('\n\n');

      system += COMPLETION_CONFIG.evidenceTemplate.replace('{chunks}', chunksText);

      this.logger.debug(
        `[Prompt] Injected ${evidence.length} evidence chunks ` +
        `(top similarity: ${evidence[0].similarity.toFixed(4)})`,
      );
    }

    return {
      system,
      user: truncatedPrefix,
    };
  }

  /**
   * Detect the legal document type from the prefix content.
   *
   * Matches common Spanish legal document keywords to classify the
   * document being edited. Returns null if no pattern matches.
   */
  detectDocumentType(prefix: string): string | null {
    const lower = prefix.toLowerCase();
    if (/contrato de|las partes acuerdan/.test(lower)) return 'CONTRATO';
    if (/\bdemanda\b|\bactor\b|\bdemandado\b/.test(lower)) return 'DEMANDA';
    if (/\bacta\b|reuni[oó]n|sesi[oó]n/.test(lower)) return 'ACTA';
    if (/providencia|juzgado|autos y vistos/.test(lower)) return 'PROVIDENCIA';
    if (/resoluci[oó]n|\bvisto\s+el\b|\bvisto\s+y\s+considerando\b|\bvistos\s+los\b|considerando/.test(lower)) return 'RESOLUCIÓN';
    return null;
  }
}

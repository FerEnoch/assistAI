import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAssembler } from '../prompt-assembler';
import { COMPLETION_CONFIG } from '@assistai/shared';
import type { RetrievalHit } from '@assistai/shared';

describe('PromptAssembler', () => {
  let assembler: PromptAssembler;

  beforeEach(() => {
    assembler = new PromptAssembler();
  });

  describe('shouldSkipRetrieval (A-071)', () => {
    it('skips retrieval for very short prefix', () => {
      const shortText = 'Hola';
      expect(assembler.shouldSkipRetrieval(shortText)).toBe(true);
    });

    it('skips retrieval for prefix shorter than threshold', () => {
      const text = 'x'.repeat(COMPLETION_CONFIG.retrievalGateMinChars - 1);
      expect(assembler.shouldSkipRetrieval(text)).toBe(true);
    });

    it('does NOT skip retrieval for prefix at or above threshold', () => {
      const text = 'x'.repeat(COMPLETION_CONFIG.retrievalGateMinChars);
      expect(assembler.shouldSkipRetrieval(text)).toBe(false);
    });

    it('trims whitespace before checking length', () => {
      const text = '   ' + 'x'.repeat(30) + '   ';
      // 30 chars < threshold of 50
      expect(assembler.shouldSkipRetrieval(text)).toBe(true);
    });

    it('does NOT skip for long real-world text', () => {
      const realText =
        'El artículo 1137 del Código Civil establece que hay contrato cuando varias personas se ponen de acuerdo sobre una declaración de voluntad común.';
      expect(assembler.shouldSkipRetrieval(realText)).toBe(false);
    });
  });

  describe('assemblePrompt (A-072)', () => {
    const fakeEvidence: RetrievalHit[] = [
      {
        chunkId: 'c1',
        documentId: 'd1',
        content: 'Artículo 1137 del Código Civil',
        similarity: 0.92,
        documentTitle: 'Código Civil',
      },
      {
        chunkId: 'c2',
        documentId: 'd2',
        content: 'Resolución 42/2024 sobre locación',
        similarity: 0.78,
        documentTitle: null,
      },
    ];

    it('returns system and user messages', () => {
      const result = assembler.assemblePrompt('Algún texto legal', []);
      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('user');
    });

    it('includes base system prompt when no evidence', () => {
      const result = assembler.assemblePrompt('Texto', []);
      expect(result.system).toContain('asistente de escritura legal');
    });

    it('injects evidence into system prompt when provided', () => {
      const result = assembler.assemblePrompt('Texto legal', fakeEvidence);

      expect(result.system).toContain('Evidencia relevante');
      expect(result.system).toContain('Artículo 1137');
      expect(result.system).toContain('Código Civil');
      expect(result.system).toContain('Resolución 42/2024');
    });

    it('formats evidence with rank, source, and similarity', () => {
      const result = assembler.assemblePrompt('Texto', fakeEvidence);

      expect(result.system).toContain('[1]');
      expect(result.system).toContain('[2]');
      expect(result.system).toContain('relevancia: 92%');
      expect(result.system).toContain('relevancia: 78%');
    });

    it('uses "Documento" as fallback when title is null', () => {
      const result = assembler.assemblePrompt('Texto', fakeEvidence);
      expect(result.system).toContain('(Documento, relevancia: 78%)');
    });

    it('truncates long prefix to maxPrefixChars (takes tail)', () => {
      const longPrefix = 'A'.repeat(COMPLETION_CONFIG.maxPrefixChars + 500);
      const result = assembler.assemblePrompt(longPrefix, []);

      expect(result.user.length).toBe(COMPLETION_CONFIG.maxPrefixChars);
      // Should take the TAIL (most recent context)
      expect(result.user).toBe(longPrefix.slice(-COMPLETION_CONFIG.maxPrefixChars));
    });

    it('preserves short prefix as-is', () => {
      const shortPrefix = 'Texto corto';
      const result = assembler.assemblePrompt(shortPrefix, []);
      expect(result.user).toBe(shortPrefix);
    });
  });
});

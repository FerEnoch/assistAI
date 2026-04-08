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

  describe('detectDocumentType', () => {
    // ─── Task 4.1: CONTRATO detection ──────────────────────────────────────
    it('returns CONTRATO when prefix contains "CONTRATO DE"', () => {
      expect(assembler.detectDocumentType('CONTRATO DE LOCACIÓN entre partes')).toBe('CONTRATO');
    });

    it('returns CONTRATO when prefix contains "las partes acuerdan"', () => {
      expect(assembler.detectDocumentType('En la ciudad de Buenos Aires, las partes acuerdan lo siguiente')).toBe('CONTRATO');
    });

    // ─── Task 4.2: DEMANDA detection ──────────────────────────────────────
    it('returns DEMANDA when prefix contains "demanda"', () => {
      expect(assembler.detectDocumentType('Vengo a interponer formal demanda contra el Estado')).toBe('DEMANDA');
    });

    it('returns DEMANDA when prefix contains "actor"', () => {
      expect(assembler.detectDocumentType('El actor solicita se haga lugar a la pretensión')).toBe('DEMANDA');
    });

    it('returns DEMANDA when prefix contains "demandado"', () => {
      expect(assembler.detectDocumentType('Cítese al demandado por el plazo de ley')).toBe('DEMANDA');
    });

    // ─── Task 4.3: ACTA detection ─────────────────────────────────────────
    it('returns ACTA when prefix contains "acta"', () => {
      expect(assembler.detectDocumentType('Se labra la presente acta a los efectos de dejar constancia')).toBe('ACTA');
    });

    it('returns ACTA when prefix contains "reunión"', () => {
      expect(assembler.detectDocumentType('En la reunión del directorio celebrada en fecha')).toBe('ACTA');
    });

    it('returns ACTA when prefix contains "sesión"', () => {
      expect(assembler.detectDocumentType('Abierta la sesión ordinaria del Honorable Concejo')).toBe('ACTA');
    });

    // ─── Task 4.4: PROVIDENCIA detection ──────────────────────────────────
    it('returns PROVIDENCIA when prefix contains "providencia"', () => {
      expect(assembler.detectDocumentType('Se dicta la presente providencia a fin de ordenar')).toBe('PROVIDENCIA');
    });

    it('returns PROVIDENCIA when prefix contains "juzgado"', () => {
      expect(assembler.detectDocumentType('El juzgado civil y comercial número 5 dispone')).toBe('PROVIDENCIA');
    });

    it('returns PROVIDENCIA when prefix contains "autos y vistos"', () => {
      expect(assembler.detectDocumentType('Autos y vistos: para resolver en la presente causa')).toBe('PROVIDENCIA');
    });

    // ─── Task 4.5: RESOLUCIÓN detection ───────────────────────────────────
    it('returns RESOLUCIÓN when prefix contains "resolución"', () => {
      expect(assembler.detectDocumentType('La presente resolución se dicta en uso de las facultades')).toBe('RESOLUCIÓN');
    });

    it('returns RESOLUCIÓN when prefix contains "visto el"', () => {
      expect(assembler.detectDocumentType('Visto el expediente número 2024-001 y los antecedentes')).toBe('RESOLUCIÓN');
    });

    it('does NOT return RESOLUCIÓN for colloquial "visto" without legal context', () => {
      expect(assembler.detectDocumentType('el documento fue visto por el notario')).toBeNull();
    });

    it('returns RESOLUCIÓN when prefix contains "considerando"', () => {
      expect(assembler.detectDocumentType('CONSIDERANDO: que la normativa vigente establece')).toBe('RESOLUCIÓN');
    });

    // ─── Task 4.6: null for unrecognized text ─────────────────────────────
    it('returns null for unrecognized plain text', () => {
      expect(assembler.detectDocumentType('Hola mundo, este es un texto cualquiera')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(assembler.detectDocumentType('')).toBeNull();
    });

    // ─── Triangulation: case-insensitive detection ────────────────────────
    it('detects document type case-insensitively', () => {
      expect(assembler.detectDocumentType('contrato de servicios profesionales')).toBe('CONTRATO');
    });
  });
});

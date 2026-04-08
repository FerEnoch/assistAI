import { describe, it, expect } from 'vitest';
import { STRUCTURAL_CONFIG } from '../completion';
import { STRUCTURAL_CONFIG as STRUCTURAL_CONFIG_INDEX } from '../index';

describe('STRUCTURAL_CONFIG', () => {
  it('should have similarityThreshold of 0.85 for high-confidence structural match', () => {
    expect(STRUCTURAL_CONFIG.similarityThreshold).toBe(0.85);
  });

  it('should have topK of 1 — only top match considered', () => {
    expect(STRUCTURAL_CONFIG.topK).toBe(1);
  });

  it('should have minPrefixChars of 100 — longer than base LLM gate of 50', () => {
    expect(STRUCTURAL_CONFIG.minPrefixChars).toBe(100);
  });

  it('should be re-exported from the config barrel index', () => {
    expect(STRUCTURAL_CONFIG_INDEX).toBe(STRUCTURAL_CONFIG);
  });
});

import { describe, it, expect } from 'vitest';
import { parseTxt, parseMarkdown } from '../parsers/txt-parser';

describe('TXT/Markdown Parser (A-042)', () => {
  it('should extract text from a buffer', () => {
    const content = 'Artículo 1. El presente contrato establece las condiciones.';
    const buffer = Buffer.from(content, 'utf-8');

    const result = parseTxt(buffer);
    expect(result).toBe(content);
  });

  it('should trim whitespace', () => {
    const buffer = Buffer.from('  texto con espacios  \n\n', 'utf-8');
    expect(parseTxt(buffer)).toBe('texto con espacios');
  });

  it('should handle empty content', () => {
    const buffer = Buffer.from('', 'utf-8');
    expect(parseTxt(buffer)).toBe('');
  });

  it('should handle UTF-8 with Spanish characters', () => {
    const text = 'Según el artículo Nº 123, la cláusula contempla señales específicas.';
    const buffer = Buffer.from(text, 'utf-8');
    expect(parseTxt(buffer)).toBe(text);
  });

  it('parseMarkdown should be identical to parseTxt', () => {
    const md = '# Título\n\n## Sección 1\n\nContenido con **negrita** y *cursiva*.';
    const buffer = Buffer.from(md, 'utf-8');
    expect(parseMarkdown(buffer)).toBe(parseTxt(buffer));
  });
});

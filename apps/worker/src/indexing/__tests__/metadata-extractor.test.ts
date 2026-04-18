import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataExtractor } from '../metadata-extractor.service';

describe('MetadataExtractor', () => {
  let extractor: MetadataExtractor;

  beforeEach(() => {
    extractor = new MetadataExtractor();
  });

  // docType tests (T-3.2 → T-3.7)
  it('returns CONTRATO for "contrato de"', () => {
    const result = extractor.extract('El contrato de arrendamiento entre las partes...');
    expect(result.docType).toBe('CONTRATO');
  });
  it('returns CONTRATO for "las partes acuerdan"', () => {
    const result = extractor.extract('Las partes acuerdan los siguientes términos...');
    expect(result.docType).toBe('CONTRATO');
  });
  it('returns DEMANDA for "demanda", "actor", "demandado"', () => {
    expect(extractor.extract('Demanda civil ordinaria').docType).toBe('DEMANDA');
    expect(extractor.extract('El actor presenta los hechos').docType).toBe('DEMANDA');
    expect(extractor.extract('El demandado se opone').docType).toBe('DEMANDA');
  });
  it('returns ACTA for "acta", "reunión", "sesión"', () => {
    expect(extractor.extract('Acta de la reunión').docType).toBe('ACTA');
    expect(extractor.extract('Sesión ordinaria del directorio').docType).toBe('ACTA');
  });
  it('returns PROVIDENCIA for "providencia", "juzgado", "autos y vistos"', () => {
    expect(extractor.extract('Providencia del juzgado civil').docType).toBe('PROVIDENCIA');
    expect(extractor.extract('Autos y vistos los presentes').docType).toBe('PROVIDENCIA');
  });
  it('returns RESOLUCIÓN for "resolución", "visto y considerando"', () => {
    expect(extractor.extract('Resolución administrativa N° 123').docType).toBe('RESOLUCIÓN');
    expect(extractor.extract('Visto y considerando los antecedentes').docType).toBe('RESOLUCIÓN');
  });
  it('returns null docType for unrecognized text', () => {
    expect(extractor.extract('Lorem ipsum dolor sit amet consectetur').docType).toBeNull();
  });

  // section tests (T-3.8 → T-3.11)
  it('returns encabezado for "entre los suscritos"', () => {
    expect(extractor.extract('Entre los suscritos, mayores de edad').section).toBe('encabezado');
  });
  it('returns encabezado for "IDENTIFICACIÓN DE LAS PARTES"', () => {
    expect(extractor.extract('IDENTIFICACIÓN DE LAS PARTES: El locador...').section).toBe(
      'encabezado',
    );
  });
  it('returns clausulas for "PRIMERA CLÁUSULA"', () => {
    expect(extractor.extract('PRIMERA CLÁUSULA: El objeto del presente contrato').section).toBe(
      'clausulas',
    );
  });
  it('returns clausulas for "CLÁUSULA SEGUNDA"', () => {
    expect(extractor.extract('CLÁUSULA SEGUNDA: Las obligaciones').section).toBe('clausulas');
  });
  it('returns considerandos for "CONSIDERANDO:"', () => {
    expect(extractor.extract('CONSIDERANDO: Que el demandante presentó prueba').section).toBe(
      'considerandos',
    );
  });
  it('returns considerandos for "Que el demandante"', () => {
    expect(extractor.extract('Que el demandante acreditó los hechos').section).toBe(
      'considerandos',
    );
  });
  it('returns fallo for "RESUELVE:"', () => {
    expect(extractor.extract('RESUELVE: Hacer lugar a la demanda').section).toBe('fallo');
  });
  it('returns fallo for "FALLA:"', () => {
    expect(extractor.extract('FALLA: Condenar al demandado').section).toBe('fallo');
  });
  it('returns fallo for "SE RESUELVE"', () => {
    expect(extractor.extract('SE RESUELVE hacer lugar a la excepción').section).toBe('fallo');
  });

  // clauseType tests (T-3.12 → T-3.14) — clauseType only when section === 'clausulas'
  it('returns confidencialidad clauseType when section is clausulas', () => {
    expect(
      extractor.extract('CLÁUSULA PRIMERA: información confidencial del negocio').clauseType,
    ).toBe('confidencialidad');
  });
  it('returns null clauseType when section is not clausulas even with matching keywords', () => {
    // "secreto comercial" alone — section won't be 'clausulas'
    expect(extractor.extract('secreto comercial de la empresa').clauseType).toBeNull();
  });
  it('returns penalidad clauseType when section is clausulas', () => {
    expect(extractor.extract('CLÁUSULA SEGUNDA: una cláusula penal con multa de diez mil pesos').clauseType).toBe(
      'penalidad',
    );
  });
  it('returns null clauseType for penalización outside clausulas section', () => {
    expect(extractor.extract('penalización por incumplimiento').clauseType).toBeNull();
  });
  it('returns fuerza_mayor clauseType when section is clausulas', () => {
    expect(extractor.extract('CLÁUSULA TERCERA: caso de fuerza mayor o caso fortuito').clauseType).toBe(
      'fuerza_mayor',
    );
  });

  // tags test (T-3.15)
  it('includes "responsabilidad" in tags when keyword present', () => {
    const result = extractor.extract('La responsabilidad del locador queda limitada');
    expect(result.tags).toContain('responsabilidad');
  });

  // defaults test (T-3.16)
  it('defaults isTemplate to false and sourceTemplateId to null', () => {
    const result = extractor.extract('cualquier texto');
    expect(result.isTemplate).toBe(false);
    expect(result.sourceTemplateId).toBeNull();
  });

  // section default is null (T-4.4)
  it('returns null section when no section pattern matches', () => {
    const result = extractor.extract('cualquier texto sin sección');
    expect(result.section).toBeNull();
  });

  // docHint precedence (T-4.3) — content patterns beat hint
  it('content pattern prevails over docHint', () => {
    const result = extractor.extract('El actor presenta una demanda civil', 'CONTRATO');
    expect(result.docType).toBe('DEMANDA');
  });
  it('docHint used as fallback when content has no patterns', () => {
    const result = extractor.extract('texto genérico sin patrones legales', 'CONTRATO');
    expect(result.docType).toBe('CONTRATO');
  });
});

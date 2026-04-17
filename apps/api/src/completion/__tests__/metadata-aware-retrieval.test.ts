import { describe, it, expect } from 'vitest';
import { MetadataAwareRetrievalService } from '../metadata-aware-retrieval.service';

/**
 * MetadataAwareRetrievalService tests — regex-based legal metadata detection (T-7.x).
 */
describe('MetadataAwareRetrievalService', () => {
  const service = new MetadataAwareRetrievalService();

  describe('detectFilters', () => {
    it('detects CONTRATO from arrendamiento text', () => {
      const result = service.detectFilters(
        'CONTRATO DE ARRENDAMIENTO entre las partes...',
      );
      expect(result).toEqual(expect.objectContaining({ docType: 'CONTRATO' }));
    });

    it('detects CONTRATO + clausulas + confidencialidad from clause text', () => {
      const result = service.detectFilters(
        'CONTRATO DE PRESTACIÓN. CLÁUSULA PRIMERA: información confidencial y secreto comercial...',
      );
      expect(result).toEqual({
        docType: 'CONTRATO',
        section: 'clausulas',
        clauseType: 'confidencialidad',
      });
    });

    it('returns null for text with no legal signal', () => {
      const result = service.detectFilters('Lorem ipsum sin señal legal');
      expect(result).toBeNull();
    });

    it('detects DEMANDA from litigation text', () => {
      const result = service.detectFilters(
        'DEMANDA ORDINARIA presentada por el actor',
      );
      expect(result).toEqual(expect.objectContaining({ docType: 'DEMANDA' }));
    });

    it('detects ACTA from meeting text', () => {
      const result = service.detectFilters(
        'ACTA de la reunión celebrada el día...',
      );
      expect(result).toEqual(expect.objectContaining({ docType: 'ACTA' }));
    });

    it('detects PROVIDENCIA from court text', () => {
      const result = service.detectFilters(
        'Providencia del juzgado tercero civil...',
      );
      expect(result).toEqual(expect.objectContaining({ docType: 'PROVIDENCIA' }));
    });

    it('detects RESOLUCIÓN from administrative text', () => {
      const result = service.detectFilters(
        'RESOLUCIÓN ADMINISTRATIVA visto y considerando los antecedentes...',
      );
      expect(result).toEqual(expect.objectContaining({ docType: 'RESOLUCIÓN' }));
    });

    it('detects encabezado section', () => {
      const result = service.detectFilters(
        'CONTRATO DE SERVICIOS. Entre los suscritos a saber...',
      );
      expect(result?.section).toBe('encabezado');
    });

    it('detects fallo section', () => {
      const result = service.detectFilters(
        'DEMANDA. El tribunal resuelve lo siguiente...',
      );
      expect(result?.section).toBe('fallo');
    });

    it('detects penalidad clause type', () => {
      const result = service.detectFilters(
        'CONTRATO DE OBRA. Cláusula penal por incumplimiento...',
      );
      expect(result?.clauseType).toBe('penalidad');
    });

    it('detects fuerza_mayor clause type', () => {
      const result = service.detectFilters(
        'CONTRATO DE SUMINISTRO. En caso de fuerza mayor o caso fortuito...',
      );
      expect(result?.clauseType).toBe('fuerza_mayor');
    });

    it('detects objeto clause type', () => {
      const result = service.detectFilters(
        'CONTRATO DE CONSULTORÍA. El objeto del contrato es la prestación...',
      );
      expect(result?.clauseType).toBe('objeto');
    });

    it('detects duracion clause type', () => {
      const result = service.detectFilters(
        'CONTRATO DE ARRIENDO. La duración del presente acuerdo...',
      );
      expect(result?.clauseType).toBe('duracion');
    });

    it('detects pago clause type', () => {
      const result = service.detectFilters(
        'CONTRATO DE SERVICIOS. Los honorarios serán de...',
      );
      expect(result?.clauseType).toBe('pago');
    });
  });
});

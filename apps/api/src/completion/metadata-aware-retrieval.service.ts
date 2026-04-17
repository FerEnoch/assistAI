import { Injectable } from '@nestjs/common';
import type { MetadataFilter, LegalDocType, LegalSection, ClauseType } from '@assistai/shared';

/**
 * Detect metadata filters from the user's current editor prefix.
 *
 * Uses regex heuristics to classify document type, section, and clause type
 * from legal text patterns. Returns null when no strong signal is found.
 */
@Injectable()
export class MetadataAwareRetrievalService {
  /**
   * Detect metadata filters from the user's current prefix.
   * Returns null if there's no strong enough signal.
   */
  detectFilters(prefix: string): MetadataFilter | null {
    const docType = this.detectDocType(prefix);
    if (!docType) return null;

    const filter: MetadataFilter = { docType };

    const section = this.detectSection(prefix);
    if (section) filter.section = section;

    const clauseType = this.detectClauseType(prefix);
    if (clauseType) filter.clauseType = clauseType;

    return filter;
  }

  private detectDocType(prefix: string): LegalDocType {
    const lower = prefix.toLowerCase();
    if (/contrato de|las partes acuerdan/.test(lower)) return 'CONTRATO';
    if (/\bdemanda\b|\bactor\b|\bdemandado\b/.test(lower)) return 'DEMANDA';
    if (/\bacta\b|reuni[oó]n|sesi[oó]n/.test(lower)) return 'ACTA';
    if (/providencia|juzgado|autos y vistos/.test(lower)) return 'PROVIDENCIA';
    if (/resoluci[oó]n|\bvisto\s+y\s+considerando\b|considerando/.test(lower)) return 'RESOLUCIÓN';
    return null;
  }

  private detectSection(prefix: string): LegalSection {
    const lower = prefix.toLowerCase();
    if (/entre los suscritos|identificaci[oó]n de las partes/.test(lower)) return 'encabezado';
    if (/\bconsiderando\b|que el demandante/.test(lower)) return 'considerandos';
    if (/cl[aá]usula\s+(primera|segunda|tercera|\d+)|primera\s+cl[aá]usula/.test(lower)) return 'clausulas';
    if (/\bresuelve\b|\bfalla\b|se resuelve/.test(lower)) return 'fallo';
    return null;
  }

  private detectClauseType(prefix: string): ClauseType {
    const lower = prefix.toLowerCase();
    if (/informaci[oó]n confidencial|secreto comercial|confidencialidad/.test(lower)) return 'confidencialidad';
    if (/cl[aá]usula penal|\bmulta de\b|penalizaci[oó]n/.test(lower)) return 'penalidad';
    if (/fuerza mayor|caso fortuito/.test(lower)) return 'fuerza_mayor';
    if (/\bobjeto\b del contrato/.test(lower)) return 'objeto';
    if (/duraci[oó]n|plazo del contrato/.test(lower)) return 'duracion';
    if (/precio|canon|honorarios/.test(lower)) return 'pago';
    return null;
  }
}

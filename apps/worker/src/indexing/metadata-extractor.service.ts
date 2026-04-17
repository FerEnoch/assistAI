import { Injectable } from '@nestjs/common';
import type {
  ChunkMetadata,
  LegalDocType,
  LegalSection,
  ClauseType,
} from '@assistai/shared';

/**
 * Extracts legal metadata from chunk content via pattern matching.
 *
 * Runs at indexing time (zero latency in completion path).
 * Deterministic and consistent with detectDocumentType in PromptAssembler.
 */
@Injectable()
export class MetadataExtractor {
  extract(content: string, docHint?: string): ChunkMetadata {
    const docType = this.detectDocType(content, docHint);
    return {
      docType,
      section: this.detectSection(content),
      clauseType: this.detectClauseType(content),
      tags: this.extractTags(content, docType),
      isTemplate: false,
      sourceTemplateId: null,
    };
  }

  private detectDocType(content: string, hint?: string): LegalDocType {
    const lower = content.toLowerCase();
    if (hint) {
      const hintLower = hint.toLowerCase();
      if (/contrato/.test(hintLower)) return 'CONTRATO';
      if (/demanda/.test(hintLower)) return 'DEMANDA';
      if (/acta/.test(hintLower)) return 'ACTA';
      if (/providencia/.test(hintLower)) return 'PROVIDENCIA';
      if (/resoluci[oó]n/.test(hintLower)) return 'RESOLUCIÓN';
      if (/poder/.test(hintLower)) return 'PODER';
    }
    if (/contrato de|las partes acuerdan/.test(lower)) return 'CONTRATO';
    if (/\bdemanda\b|\bactor\b|\bdemandado\b/.test(lower)) return 'DEMANDA';
    if (/\bacta\b|reuni[oó]n|sesi[oó]n/.test(lower)) return 'ACTA';
    if (/providencia|juzgado|autos y vistos/.test(lower)) return 'PROVIDENCIA';
    if (/resoluci[oó]n|\bvisto\s+el\b|\bvisto\s+y\s+considerando\b|\bvistos\s+los\b|considerando/.test(lower))
      return 'RESOLUCIÓN';
    if (/poder especial|poder general|apoderado/.test(lower)) return 'PODER';
    return null;
  }

  private detectSection(content: string): LegalSection {
    const lower = content.toLowerCase();
    if (/entre los suscritos|identificaci[oó]n de las partes|comparecen/.test(lower))
      return 'encabezado';
    if (/\bconsiderando\b|que el demandante|que la parte actora/.test(lower))
      return 'considerandos';
    if (
      /cl[aá]usula\s+(primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|décima|\d+)|primera\s+cl[aá]usula|segunda\s+cl[aá]usula/.test(
        lower,
      )
    )
      return 'clausulas';
    if (/\bresuelve\b|\bfalla\b|se resuelve|por ello\s*,?\s*resuelvo|fallo definitivo/.test(lower))
      return 'fallo';
    return 'cuerpo';
  }

  private detectClauseType(content: string): ClauseType {
    const lower = content.toLowerCase();
    if (/informaci[oó]n confidencial|secreto comercial|confidencialidad/.test(lower))
      return 'confidencialidad';
    if (/cl[aá]usula penal|\bmulta de\b|penalizaci[oó]n|pena convencional/.test(lower))
      return 'penalidad';
    if (/fuerza mayor|caso fortuito/.test(lower)) return 'fuerza_mayor';
    if (
      /\bobjeto\b del (presente )?contrato|cl[aá]usula (primera|1[a°]?):?\s*(objeto|prestaci[oó]n)/.test(
        lower,
      )
    )
      return 'objeto';
    if (/duraci[oó]n|plazo del contrato|vigencia del presente/.test(lower)) return 'duracion';
    if (/precio|canon|remuneraci[oó]n|honorarios|monto mensual/.test(lower)) return 'pago';
    return null;
  }

  private extractTags(content: string, _docType: LegalDocType): string[] {
    const legalKeywords = [
      'responsabilidad',
      'incumplimiento',
      'rescisión',
      'nulidad',
      'mora',
      'garantía',
      'fiador',
      'locador',
      'locatario',
      'arrendamiento',
      'domicilio',
      'jurisdicción',
      'notificación',
      'cesión',
      'sublocación',
      'depósito',
      'expensas',
      'actualización',
      'índice',
      'rescate',
    ];
    const lower = content.toLowerCase();
    return legalKeywords.filter((kw) => lower.includes(kw)).slice(0, 10);
  }
}

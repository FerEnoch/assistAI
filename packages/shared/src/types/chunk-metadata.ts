export type LegalDocType =
  | 'CONTRATO'
  | 'DEMANDA'
  | 'ACTA'
  | 'PROVIDENCIA'
  | 'RESOLUCIÓN'
  | 'PODER'
  | null;

export type LegalSection =
  | 'encabezado'
  | 'considerandos'
  | 'clausulas'
  | 'fallo'
  | 'cuerpo'
  | null;

export type ClauseType =
  | 'confidencialidad'
  | 'penalidad'
  | 'fuerza_mayor'
  | 'objeto'
  | 'duracion'
  | 'pago'
  | null;

export interface ChunkMetadata {
  docType: LegalDocType;
  section: LegalSection;
  clauseType: ClauseType;
  tags: string[];
  isTemplate: boolean;
  sourceTemplateId: string | null;
}

export interface MetadataFilter {
  docType?: LegalDocType;
  section?: LegalSection;
  clauseType?: ClauseType;
  tags?: string[];
  isTemplate?: boolean;
}

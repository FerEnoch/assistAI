# Spec: chunk-metadata-schema

## Purpose

Definir la estructura de datos `ChunkMetadata` que se persiste en la columna `metadata` (jsonb) de `document_chunks`, los tipos auxiliares que la componen, y el tipo `MetadataFilter` usado para filtrar en retrieval.

---

## Requirements

### Requirement: ChunkMetadata interface

`ChunkMetadata` MUST be defined in `packages/shared/src/types/chunk-metadata.ts` y exportada desde el barrel de types del paquete shared.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `docType` | `LegalDocType` | Sí | Tipo de documento legal. `null` si no se puede detectar |
| `section` | `LegalSection` | Sí | Sección del documento donde aparece el chunk. `null` si no detectado |
| `clauseType` | `ClauseType` | Sí | Tipo de cláusula, si aplica. `null` para chunks que no son cláusulas |
| `tags` | `string[]` | Sí | Keywords legales relevantes. Array vacío si no hay. Máximo 10 elementos |
| `isTemplate` | `boolean` | Sí | `true` si el chunk proviene de un template definido por el usuario |
| `sourceTemplateId` | `string \| null` | Sí | UUID del template origen, si `isTemplate === true`. `null` en todos los demás casos |

#### Scenario: Chunk de contrato con cláusula de confidencialidad

- GIVEN un chunk de documento con contenido "La información compartida en virtud del presente contrato tendrá carácter confidencial..."
- WHEN `MetadataExtractor.extract()` procesa el chunk
- THEN el resultado MUST ser:
  ```json
  {
    "docType": "CONTRATO",
    "section": "clausulas",
    "clauseType": "confidencialidad",
    "tags": ["confidencial", "información", "contrato"],
    "isTemplate": false,
    "sourceTemplateId": null
  }
  ```

#### Scenario: Chunk de demanda sin cláusula específica

- GIVEN un chunk con "El actor solicita se condene al demandado..."
- WHEN `MetadataExtractor.extract()` procesa el chunk
- THEN `docType` MUST ser `'DEMANDA'`, `clauseType` MUST ser `null`, `isTemplate` MUST ser `false`

#### Scenario: Chunk sin patrones legales

- GIVEN un chunk con texto genérico sin patrones legales
- WHEN `MetadataExtractor.extract()` procesa el chunk
- THEN `docType` MUST ser `null`, `section` MUST ser `null`, `clauseType` MUST ser `null`, `tags` MUST ser `[]`

---

### Requirement: LegalDocType

`LegalDocType` MUST ser un union type:

```typescript
export type LegalDocType =
  | 'CONTRATO'
  | 'DEMANDA'
  | 'ACTA'
  | 'PROVIDENCIA'
  | 'RESOLUCIÓN'
  | 'PODER'
  | null;
```

Los valores MUST ser en mayúsculas y en español.

---

### Requirement: LegalSection

`LegalSection` MUST ser un union type que representa la posición estructural del chunk dentro del documento:

```typescript
export type LegalSection =
  | 'encabezado'
  | 'considerandos'
  | 'clausulas'
  | 'fallo'
  | 'cuerpo'
  | null;
```

#### Scenario: Detección de sección por keywords

| Keyword(s) en chunk | `section` esperada |
|--------------------|-------------------|
| "entre los suscritos", "IDENTIFICACIÓN DE LAS PARTES", "COMPARECEN" | `'encabezado'` |
| "PRIMERA CLÁUSULA", "CLÁUSULA SEGUNDA", "Primera.-" | `'clausulas'` |
| "CONSIDERANDO:", "Que el demandante", "Que con fecha" | `'considerandos'` |
| "RESUELVE:", "FALLA:", "SE RESUELVE:", "FALLO:" | `'fallo'` |
| (ningún patrón estructural reconocible) | `null` |

---

### Requirement: ClauseType

`ClauseType` MUST ser un union type. Solo aplica cuando `section === 'clausulas'`. En todos los demás casos MUST ser `null`.

```typescript
export type ClauseType =
  | 'confidencialidad'
  | 'penalidad'
  | 'fuerza_mayor'
  | 'objeto'
  | 'duracion'
  | 'pago'
  | null;
```

#### Scenario: ClauseType fuera de sección de cláusulas

- GIVEN un chunk con `section !== 'clausulas'`
- WHEN se extrae la metadata
- THEN `clauseType` MUST ser `null` independientemente del contenido del chunk

---

### Requirement: MetadataFilter

`MetadataFilter` MUST ser un type con todos los campos opcionales para permitir filtros parciales:

```typescript
export interface MetadataFilter {
  docType?: LegalDocType;
  section?: LegalSection;
  clauseType?: ClauseType;
  tags?: string[];      // Match si el chunk tiene AL MENOS UNO de los tags del array
  isTemplate?: boolean;
}
```

#### Scenario: Filtro serializado como jsonb

- GIVEN `MetadataFilter = { docType: 'CONTRATO', section: 'clausulas' }`
- WHEN se construye el SQL para `findSimilarChunks`
- THEN el WHERE jsonb MUST ser `metadata @> '{"docType":"CONTRATO","section":"clausulas"}'::jsonb`
- AND los campos `undefined` del filtro MUST ser omitidos de la serialización

#### Scenario: Filtro vacío equivale a sin filtro

- GIVEN `MetadataFilter = {}`
- WHEN se construye el SQL
- THEN NO se agrega ningún WHERE jsonb adicional (equivalente a filtros no aplicados)

---

### Requirement: DB Column

La columna `metadata` en `document_chunks` MUST cumplir:
- Tipo: `jsonb` (no `json`) — para soporte de GIN index y operador `@>`
- Nullable: `true` — chunks existentes sin metadata retornan `null`
- Default: `NULL`
- Index: `CREATE INDEX idx_document_chunks_metadata_gin ON document_chunks USING GIN (metadata)` — para queries `@>` eficientes

#### Scenario: Migration reversible

- GIVEN la migration `add-chunk-metadata` fue aplicada
- WHEN se ejecuta `down()`
- THEN `DROP INDEX idx_document_chunks_metadata_gin` MUST ejecutar sin errores
- AND `ALTER TABLE document_chunks DROP COLUMN metadata` MUST ejecutar sin errores
- AND no debe existir ningún NOT NULL constraint en la columna (para que la migration sea reversible sin data loss)

# Design: chunk-metadata-and-smart-retrieval

## Technical Approach

Three-phase feature que agrega una capa de metadata estructurada al pipeline de indexing y retrieval existente. La metadata se extrae por pattern matching durante el indexing (zero latency en el completion path), se persiste en jsonb, y se usa opcionalmente como filtro en `findSimilarChunks` via SQL WHERE dinámico.

La filosofía es **additive-only**: ninguna query existente se rompe. El filtro es opcional; si no hay metadata o los filtros vacían el resultado, el sistema cae al comportamiento actual.

## Arquitectura de decisiones

| Decisión | Opción elegida | Alternativas | Justificación |
|----------|---------------|-------------|---------------|
| Storage de metadata | jsonb column en `document_chunks` | Tabla separada `chunk_metadata`, columnas dedicadas | jsonb permite queries flexibles con GIN index; evita JOIN extra; schema evolutivo sin migrations |
| Extracción de metadata | Pattern matching en indexing worker | Embedding classification, LLM at index time | Zero latency en completion path; determinístico; consistente con filosofía de `detectDocumentType` |
| Aplicación de filtros | WHERE jsonb opcional en SQL nativo | Post-filter en memoria, GraphQL-style filtering | Eficiencia pgvector + filtro en misma query; GIN index en jsonb; sin doble round-trip |
| Fallback sin hits | Reintentar sin filtros | Retornar vacío, usar threshold más bajo | UX: siempre hay completions; degradación silenciosa |
| `MetadataFilter` location | `packages/shared/src/types/` | En cada app | Compartido entre worker (escribe) y API (lee) |

## Data Flow

### Indexing Path (Phase 2)

```
Document content
       │
       ▼
chunker.split() → chunks[]
       │
       ▼  (POR CADA CHUNK)
MetadataExtractor.extract(chunk.content, docHint?)
       │
       ▼
ChunkMetadata {
  docType: 'CONTRATO' | 'DEMANDA' | ... | null
  section: 'encabezado' | 'considerandos' | 'clausulas' | 'fallo' | null
  clauseType: 'confidencialidad' | 'penalidad' | 'fuerza_mayor' | null
  tags: string[]
  isTemplate: false
  sourceTemplateId: null
}
       │
       ▼
DocumentChunk { ...existing, metadata: ChunkMetadata }
       │
       ▼
INSERT INTO document_chunks (..., metadata) VALUES (..., $n::jsonb)
```

### Completion Path (Phase 3)

```
User types prefix
       │
       ▼
CompletionService.runPipeline()
       │
       ▼
MetadataAwareRetrievalService.detectFilters(prefix)
       │  → { docType: 'CONTRATO', section: 'clausulas' } | null
       ▼
findSimilarChunks(workspaceId, queryEmbedding, {
  topK: 4,
  threshold: 0.72,
  filters: MetadataFilter | undefined
})
       │
       ├─ CON FILTROS: SELECT ... WHERE embedding <=> $1 < $2 AND metadata @> $3::jsonb
       │  → Si hits.length === 0: REINTENTAR SIN FILTROS (fallback)
       │
       └─ SIN FILTROS: SELECT ... WHERE embedding <=> $1 < $2   (comportamiento actual)
       │
       ▼
evidence[] = RetrievalHit[] (ahora incluye .metadata)
       │
       ▼
[structural gate] → LLM path o structural path (sin cambios)
```

## Schema

```typescript
// packages/shared/src/types/chunk-metadata.ts

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
  tags?: string[];        // ANY match (chunk debe tener al menos un tag del array)
  isTemplate?: boolean;
}
```

```typescript
// packages/shared/src/types/retrieval.ts (modificación)
export interface RetrievalHit {
  // ...existing fields
  metadata?: ChunkMetadata | null;  // NEW — nullable para chunks sin metadata
}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types/chunk-metadata.ts` | Create | `ChunkMetadata`, `MetadataFilter`, tipos auxiliares |
| `packages/shared/src/types/retrieval.ts` | Modify | Agregar `metadata?: ChunkMetadata \| null` a `RetrievalHit` |
| `packages/shared/src/types/index.ts` | Modify | Exportar `ChunkMetadata`, `MetadataFilter`, `LegalDocType`, `LegalSection`, `ClauseType` |
| `packages/entities/src/document-chunk.entity.ts` | Modify | Columna `@Column({ type: 'jsonb', nullable: true }) metadata?: ChunkMetadata \| null` |
| `packages/db/src/migrations/<timestamp>-add-chunk-metadata.ts` | Create | `ADD COLUMN metadata jsonb` + `CREATE INDEX ... USING GIN (metadata)` |
| `apps/worker/src/indexing/metadata-extractor.service.ts` | Create | `MetadataExtractor` injectable — `extract(content, docHint?)` |
| `apps/worker/src/indexing/indexing.worker.ts` | Modify | Inject `MetadataExtractor`, llamar por chunk, pasar a `DocumentChunk.metadata` |
| `apps/worker/src/indexing/indexing.module.ts` | Modify | Registrar `MetadataExtractor` en providers |
| `apps/api/src/retrieval/retrieval.service.ts` | Modify | `findSimilarChunks` acepta `filters?: MetadataFilter`; construir WHERE jsonb dinámico |
| `apps/api/src/completion/metadata-aware-retrieval.service.ts` | Create | `detectFilters(prefix): MetadataFilter \| null` |
| `apps/api/src/completion/completion.service.ts` | Modify | Inject `MetadataAwareRetrievalService`, detectar y pasar filtros, manejar fallback |
| `apps/api/src/completion/completion.module.ts` | Modify | Registrar `MetadataAwareRetrievalService` |
| `apps/worker/src/indexing/__tests__/metadata-extractor.test.ts` | Create | Tests unitarios para `MetadataExtractor` |
| `apps/api/src/retrieval/__tests__/retrieval.service.metadata.test.ts` | Create | Tests de `findSimilarChunks` con filtros |
| `apps/api/src/completion/__tests__/metadata-aware-retrieval.test.ts` | Create | Tests de `detectFilters` |

## Interfaces / Contracts

```typescript
// MetadataExtractor
@Injectable()
class MetadataExtractor {
  extract(content: string, docHint?: string): ChunkMetadata
  private detectSection(content: string): LegalSection
  private detectClauseType(content: string): ClauseType
  private extractTags(content: string, docType: LegalDocType): string[]
}
```

```typescript
// findSimilarChunks modificado
interface FindSimilarChunksOptions {
  topK: number;
  threshold: number;
  filters?: MetadataFilter;  // NEW
}

// SQL generado cuando hay filters:
// SELECT ..., metadata
// FROM document_chunks
// WHERE workspace_id = $1
//   AND 1 - (embedding <=> $2) >= $3
//   AND metadata @> $4::jsonb          ← solo si filters !== undefined
// ORDER BY embedding <=> $2
// LIMIT $5
```

```typescript
// MetadataAwareRetrievalService
@Injectable()
class MetadataAwareRetrievalService {
  detectFilters(prefix: string): MetadataFilter | null
  // Reusa lógica de detectDocumentType para docType
  // Detecta section por keywords de posición en el documento
  // Retorna null si no hay suficiente señal en el prefijo
}
```

```typescript
// CompletionService — runPipeline modificado
const metadataFilter = this.metadataAwareRetrieval.detectFilters(prefix);
let evidence = await this.retrieval.findSimilarChunks(workspaceId, embedding, {
  topK: COMPLETION_CONFIG.topK,
  threshold: COMPLETION_CONFIG.similarityThreshold,
  filters: metadataFilter ?? undefined,
});

// FALLBACK: si hay filtros pero 0 hits, reintentar sin filtros
if (metadataFilter && evidence.length === 0) {
  evidence = await this.retrieval.findSimilarChunks(workspaceId, embedding, {
    topK: COMPLETION_CONFIG.topK,
    threshold: COMPLETION_CONFIG.similarityThreshold,
  });
}
```

## Migration

```sql
-- Up
ALTER TABLE document_chunks ADD COLUMN metadata jsonb;
CREATE INDEX idx_document_chunks_metadata_gin ON document_chunks USING GIN (metadata);

-- Down
DROP INDEX IF EXISTS idx_document_chunks_metadata_gin;
ALTER TABLE document_chunks DROP COLUMN IF EXISTS metadata;
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `MetadataExtractor.extract` | 20+ tests cubriendo todos los docTypes, sections, clauseTypes, tags, edge cases |
| Unit | `MetadataAwareRetrievalService.detectFilters` | 15+ tests: prefijos de contratos, demandas, actas, sin señal |
| Integration | `findSimilarChunks` con filters | Mock pgvector, verificar SQL WHERE jsonb generado |
| Integration | Fallback sin hits | Primer call retorna []; verificar segundo call sin filtros |
| Integration | `CompletionService` con metadata | Pipeline completo con mock retrieval |

## Migration / Rollout

- **DB migration**: `ADD COLUMN metadata jsonb` — no breaking, nullable, default NULL
- **Chunks existentes**: `metadata = null` — retrieval sin filtros funciona igual que hoy
- **Chunks nuevos**: `metadata` poblada por `MetadataExtractor` en indexing
- **Rollback**: Revertir `CompletionService` a no detectar filtros; columna puede quedar

## Open Questions

- [ ] ¿Cuántos tags máximos por chunk? → Propuesta: máximo 10 para no contaminar el índice GIN
- [ ] ¿Reusar `detectDocumentType` de `PromptAssembler` o copiar/importar lógica en worker? → Importar desde shared para evitar duplicación

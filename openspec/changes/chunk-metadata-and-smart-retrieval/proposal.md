# Proposal: chunk-metadata-and-smart-retrieval

## Intent

El retrieval actual es puramente semántico: pgvector computa cosine similarity entre el embedding del prefijo y todos los chunks del workspace, y retorna los top-4. No hay ningún filtro estructural. Esto significa que al escribir la cláusula de confidencialidad de un contrato, el sistema puede traer como evidencia un párrafo de una demanda judicial — técnicamente similar en vocabulario, pero completamente irrelevante en contexto.

Este cambio agrega **metadata estructurada a los chunks** (tipo de documento, sección, tipo de cláusula, tags) y modifica el retrieval para filtrar por esa metadata cuando corresponda. El resultado: completions más precisas porque la evidencia está calificada, no solo semánticamente similar.

## Scope

### In Scope
- Columna `metadata` (jsonb) en `DocumentChunk` con migration de TypeORM
- Interface `ChunkMetadata` en `packages/shared/src/types/`
- `MetadataExtractor` service: extrae metadata del contenido del chunk durante indexing
- Modificación del `IndexingWorker` para llamar a `MetadataExtractor` por chunk
- `MetadataFilter` type + soporte en `findSimilarChunks` (SQL WHERE dinámico)
- `MetadataAwareRetrievalService` que detecta filtros relevantes y los aplica
- Modificación del `CompletionService` para pasar filtros al retrieval
- Propagación de metadata a `RetrievalHit` (ya visible en `EvidencePanel`)

### Out of Scope
- Embedding classification para metadata (keyword/pattern matching solo — misma filosofía que `detectDocumentType`)
- UI de edición de metadata por parte del usuario (Change 2: user-defined-structures)
- Re-indexación retroactiva de documentos existentes (migration solo agrega columna nullable)
- Búsqueda de chunks por metadata desde la UI
- Tags custom definidos por el usuario

## Capabilities

### New Capabilities
- `chunk-metadata-extraction`: Al indexar un documento, cada chunk recibe metadata auto-clasificada: `docType`, `section`, `clauseType`, `tags`, `isTemplate`.
- `metadata-aware-retrieval`: El retrieval puede recibir `MetadataFilter` y aplicar un WHERE jsonb en pgvector. La detección de filtros es automática desde el prefijo del usuario.

### Modified Capabilities
- `completion-pipeline`: Antes de llamar `findSimilarChunks`, el pipeline detecta metadata relevante del prefijo y la pasa como filtro. La evidencia retornada incluye el campo `metadata` en `RetrievalHit`.
- `indexing-pipeline`: El `IndexingWorker` extrae metadata por chunk y la persiste en la columna jsonb.

## Approach

**Phase 1 — Schema + Migration**

1. Definir `ChunkMetadata` interface en `packages/shared/src/types/chunk-metadata.ts`
2. Agregar columna `metadata` (jsonb, nullable) a `DocumentChunk` entity
3. Crear migration de TypeORM: `ALTER TABLE document_chunks ADD COLUMN metadata jsonb`
4. Crear index GIN en `metadata` para queries jsonb eficientes

**Phase 2 — MetadataExtractor**

1. Crear `MetadataExtractor` service injectable
2. `extract(content: string, docHint?: string): ChunkMetadata` — pattern matching sobre el contenido del chunk
3. Lógica: detectar `docType` (reusa patrones de `detectDocumentType`), detectar `section` (encabezado/considerandos/fallo/clausulas), detectar `clauseType` (confidencialidad/penalidad/fuerza_mayor), extraer `tags` (keywords relevantes)
4. Modificar `IndexingWorker` para llamar `MetadataExtractor` por chunk antes de persistir

**Phase 3 — Metadata-Aware Retrieval**

1. Definir `MetadataFilter` type en shared
2. Modificar `findSimilarChunks` signature para aceptar `filters?: MetadataFilter`
3. Construir SQL WHERE dinámico: `metadata @> $N::jsonb` cuando hay filtros
4. Crear `MetadataAwareRetrievalService.detectFilters(prefix): MetadataFilter | null` — detecta filtros automáticamente del prefijo
5. Modificar `CompletionService.runPipeline()` para llamar `detectFilters` y pasar al retrieval

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/src/types/chunk-metadata.ts` | New | `ChunkMetadata` interface + `MetadataFilter` type |
| `packages/shared/src/types/index.ts` | Modified | Exportar nuevos types |
| `packages/entities/src/document-chunk.entity.ts` | Modified | Columna `metadata: jsonb` |
| `packages/db/src/migrations/` | New | Migration: ADD COLUMN + GIN index |
| `apps/worker/src/indexing/metadata-extractor.service.ts` | New | Auto-extracción de metadata por chunk |
| `apps/worker/src/indexing/indexing.worker.ts` | Modified | Llama a `MetadataExtractor` antes de persistir chunk |
| `apps/api/src/retrieval/retrieval.service.ts` | Modified | Soporte `MetadataFilter` en `findSimilarChunks` |
| `apps/api/src/completion/metadata-aware-retrieval.service.ts` | New | Detecta filtros relevantes del prefijo |
| `apps/api/src/completion/completion.service.ts` | Modified | Detecta y aplica `MetadataFilter` en `runPipeline` |
| `packages/shared/src/types/retrieval.ts` | Modified | `RetrievalHit.metadata?: ChunkMetadata` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| GIN index ralentiza inserts en indexing | Low | Indexing es async background worker; latency no impacta UX |
| Pattern matching genera falsos positivos en metadata | Medium | Metadata nullable — si no matchea, no aplica filtro (no filtra mal, solo no filtra) |
| Filtros demasiado restrictivos vacían el retrieval | Low | Fallback: si `metadata-aware retrieval` retorna 0 hits, reintentar sin filtros |
| Migration en prod rompe queries existentes | Low | Columna nullable + DEFAULT NULL — ninguna query existente falla |

## Rollback Plan

- La columna `metadata` es nullable — el sistema funciona con `null` sin cambios de comportamiento
- `MetadataFilter` es opcional en `findSimilarChunks` — si no se pasa, SQL es idéntico al actual
- Revertir cambios en `CompletionService` elimina la detección de filtros

## Dependencies

- PostgreSQL con soporte jsonb (ya presente)
- pgvector operativo (ya presente)
- `detectDocumentType()` implementado (ya presente en `PromptAssembler`)

## Success Criteria

- [ ] Chunks nuevos tienen `metadata` persistida en jsonb con docType/section/clauseType
- [ ] `findSimilarChunks` acepta `MetadataFilter` y aplica WHERE jsonb correctamente
- [ ] Retrieval con filtro `{ docType: 'CONTRATO' }` retorna solo chunks de contratos
- [ ] Si retrieval con filtros retorna 0 hits, fallback a retrieval sin filtros
- [ ] `RetrievalHit.metadata` disponible en `EvidencePanel`
- [ ] 30+ tests pasando (extractor unit tests + retrieval integration tests)
- [ ] Migration reversible (columna nullable)

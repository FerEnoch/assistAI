# Tasks: chunk-metadata-and-smart-retrieval

## Phase 1 — Schema, Types y Migration

### 1. Shared Types
- [ ] **T-1.1** Crear `packages/shared/src/types/chunk-metadata.ts`: definir `LegalDocType`, `LegalSection`, `ClauseType`, `ChunkMetadata` interface, `MetadataFilter` interface — todos con `| null` para campos opcionales
- [ ] **T-1.2** Modificar `packages/shared/src/types/retrieval.ts`: agregar campo `metadata?: ChunkMetadata | null` a la interface `RetrievalHit`
- [ ] **T-1.3** Modificar `packages/shared/src/types/index.ts` (o barrel correspondiente): exportar `ChunkMetadata`, `MetadataFilter`, `LegalDocType`, `LegalSection`, `ClauseType`

### 2. Entity + Migration
- [ ] **T-2.1** Modificar `packages/entities/src/document-chunk.entity.ts`: agregar `@Column({ type: 'jsonb', nullable: true }) metadata?: ChunkMetadata | null`
- [ ] **T-2.2** Crear migration en `packages/db/src/migrations/<timestamp>-add-chunk-metadata.ts`: `up()` → `ALTER TABLE document_chunks ADD COLUMN metadata jsonb; CREATE INDEX idx_document_chunks_metadata_gin ON document_chunks USING GIN (metadata)` — `down()` → `DROP INDEX; ALTER TABLE DROP COLUMN`
- [ ] **T-2.3** Verificar que migration corre sin errores en ambiente local con `pnpm migration:run` (o el comando equivalente del proyecto)

## Phase 2 — MetadataExtractor (Worker)

### 3. Unit Tests primero (TDD)
- [ ] **T-3.1** Crear `apps/worker/src/indexing/__tests__/metadata-extractor.test.ts`
- [ ] **T-3.2** Test: `extract()` retorna `docType: 'CONTRATO'` para contenido con "contrato de" / "las partes acuerdan"
- [ ] **T-3.3** Test: retorna `docType: 'DEMANDA'` para "demanda", "actor", "demandado"
- [ ] **T-3.4** Test: retorna `docType: 'ACTA'` para "acta", "reunión", "sesión"
- [ ] **T-3.5** Test: retorna `docType: 'PROVIDENCIA'` para "providencia", "juzgado", "autos y vistos"
- [ ] **T-3.6** Test: retorna `docType: 'RESOLUCIÓN'` para "resolución", "visto y considerando"
- [ ] **T-3.7** Test: retorna `docType: null` para texto sin patrones legales reconocibles
- [ ] **T-3.8** Test: retorna `section: 'encabezado'` para chunks con "entre los suscritos", "IDENTIFICACIÓN DE LAS PARTES"
- [ ] **T-3.9** Test: retorna `section: 'clausulas'` para chunks con "PRIMERA CLÁUSULA", "CLÁUSULA SEGUNDA"
- [ ] **T-3.10** Test: retorna `section: 'considerandos'` para chunks con "CONSIDERANDO:", "Que el demandante"
- [ ] **T-3.11** Test: retorna `section: 'fallo'` para chunks con "RESUELVE:", "FALLA:", "SE RESUELVE"
- [ ] **T-3.12** Test: retorna `clauseType: 'confidencialidad'` para "información confidencial", "secreto comercial"
- [ ] **T-3.13** Test: retorna `clauseType: 'penalidad'` para "cláusula penal", "multa de", "penalización"
- [ ] **T-3.14** Test: retorna `clauseType: 'fuerza_mayor'` para "fuerza mayor", "caso fortuito"
- [ ] **T-3.15** Test: `tags` contiene "responsabilidad" para contenido con esa keyword
- [ ] **T-3.16** Test: `isTemplate: false` por defecto; `sourceTemplateId: null` por defecto

### 4. Implementación MetadataExtractor
- [ ] **T-4.1** Crear `apps/worker/src/indexing/metadata-extractor.service.ts` con `@Injectable() MetadataExtractor`
- [ ] **T-4.2** Implementar `extract(content: string, docHint?: string): ChunkMetadata` — orquesta la detección completa
- [ ] **T-4.3** Implementar `private detectDocType(content: string, hint?: string): LegalDocType` — reusa patrones de `detectDocumentType` de `PromptAssembler`, extender para `PODER`
- [ ] **T-4.4** Implementar `private detectSection(content: string): LegalSection` — patterns para encabezado/considerandos/clausulas/fallo
- [ ] **T-4.5** Implementar `private detectClauseType(content: string): ClauseType` — patterns para confidencialidad/penalidad/fuerza_mayor/objeto/duracion/pago
- [ ] **T-4.6** Implementar `private extractTags(content: string, docType: LegalDocType): string[]` — extraer hasta 10 keywords legales relevantes
- [ ] **T-4.7** Registrar `MetadataExtractor` en `apps/worker/src/indexing/indexing.module.ts` providers array
- [ ] **T-4.8** Inyectar `MetadataExtractor` en `IndexingWorker` constructor
- [ ] **T-4.9** Llamar `this.metadataExtractor.extract(chunk.content)` por cada chunk antes de persistir; asignar resultado a `chunk.metadata`

## Phase 3 — Metadata-Aware Retrieval (API)

### 5. Unit Tests retrieval
- [ ] **T-5.1** Crear `apps/api/src/retrieval/__tests__/retrieval.service.metadata.test.ts`
- [ ] **T-5.2** Test: `findSimilarChunks` SIN filtros genera el mismo SQL que antes (no regresión)
- [ ] **T-5.3** Test: con `filters: { docType: 'CONTRATO' }` — SQL incluye `metadata @> '{"docType":"CONTRATO"}'::jsonb`
- [ ] **T-5.4** Test: con `filters: { section: 'clausulas' }` — SQL incluye filtro de section
- [ ] **T-5.5** Test: con `filters: {}` (vacío) — no agrega WHERE extra (equivalente a sin filtros)
- [ ] **T-5.6** Test: resultado incluye campo `metadata` en cada `RetrievalHit`

### 6. Implementación retrieval con filtros
- [ ] **T-6.1** Modificar `apps/api/src/retrieval/retrieval.service.ts`: extender interface `FindSimilarChunksOptions` con `filters?: MetadataFilter`
- [ ] **T-6.2** Construir SQL WHERE jsonb dinámico: si `filters` tiene campos definidos → `AND metadata @> $N::jsonb` — serializar solo los campos no-undefined del filtro
- [ ] **T-6.3** Seleccionar columna `metadata` en el SELECT del SQL nativo de `findSimilarChunks`
- [ ] **T-6.4** Mapear `metadata` del row al `RetrievalHit` resultante

### 7. MetadataAwareRetrievalService
- [ ] **T-7.1** Crear `apps/api/src/completion/__tests__/metadata-aware-retrieval.test.ts`
- [ ] **T-7.2** Test: `detectFilters('CONTRATO DE ARRENDAMIENTO...')` retorna `{ docType: 'CONTRATO' }`
- [ ] **T-7.3** Test: prefix con "CLÁUSULA DE CONFIDENCIALIDAD" retorna `{ docType: 'CONTRATO', section: 'clausulas', clauseType: 'confidencialidad' }`
- [ ] **T-7.4** Test: prefix sin señal retorna `null`
- [ ] **T-7.5** Test: prefix con "DEMANDA ORDINARIA" retorna `{ docType: 'DEMANDA' }`
- [ ] **T-7.6** Crear `apps/api/src/completion/metadata-aware-retrieval.service.ts` con `@Injectable() MetadataAwareRetrievalService`
- [ ] **T-7.7** Implementar `detectFilters(prefix: string): MetadataFilter | null`

### 8. CompletionService integration
- [ ] **T-8.1** Agregar test en integration test file: con mock retrieval, si `detectFilters` retorna filtro → `findSimilarChunks` llamado con ese filtro
- [ ] **T-8.2** Agregar test: si retrieval con filtros retorna `[]` → se hace segundo call sin filtros (fallback verificado)
- [ ] **T-8.3** Registrar `MetadataAwareRetrievalService` en `apps/api/src/completion/completion.module.ts`
- [ ] **T-8.4** Inyectar `MetadataAwareRetrievalService` en `CompletionService`
- [ ] **T-8.5** En `runPipeline()`: llamar `detectFilters(prefix)` para obtener `metadataFilter`
- [ ] **T-8.6** Pasar `filters: metadataFilter ?? undefined` a `findSimilarChunks`
- [ ] **T-8.7** Implementar fallback: si `metadataFilter && evidence.length === 0` → reintentar sin filtros

---

## Implementation Order

```
T-1.1 → T-1.2 → T-1.3 (shared types)
T-2.1 → T-2.2 → T-2.3 (entity + migration)
T-3.x (tests MetadataExtractor — TDD)
T-4.1 → T-4.2 → T-4.3 → T-4.4 → T-4.5 → T-4.6 → T-4.7 → T-4.8 → T-4.9 (implementar extractor)
T-5.x (tests retrieval)
T-6.1 → T-6.2 → T-6.3 → T-6.4 (implementar retrieval con filtros)
T-7.1 → T-7.2 → T-7.3 → T-7.4 → T-7.5 → T-7.6 → T-7.7 (MetadataAwareRetrieval)
T-8.1 → T-8.2 → T-8.3 → T-8.4 → T-8.5 → T-8.6 → T-8.7 (integración CompletionService)
```

**Total: 46 tasks** en 8 fases.

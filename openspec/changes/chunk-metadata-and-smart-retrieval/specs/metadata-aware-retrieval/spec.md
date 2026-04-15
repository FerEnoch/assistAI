# Spec: metadata-aware-retrieval

## Purpose

Definir el comportamiento de `MetadataAwareRetrievalService`, el soporte de `MetadataFilter` en `findSimilarChunks`, y la lógica de fallback en el pipeline de completion cuando los filtros vacían el resultado.

---

## Requirements

### Requirement: findSimilarChunks con MetadataFilter opcional

`RetrievalService.findSimilarChunks()` MUST aceptar un campo opcional `filters?: MetadataFilter` en sus opciones. Cuando `filters` está presente y tiene al menos un campo definido, MUST agregar un WHERE jsonb al SQL nativo. Cuando `filters` está ausente o es vacío, el SQL MUST ser idéntico al actual (no regresión).

#### Scenario: Sin filtros — comportamiento actual preservado

- GIVEN una llamada a `findSimilarChunks` sin el campo `filters`
- WHEN se ejecuta la query
- THEN el SQL generado MUST ser idéntico al SQL pre-change
- AND todos los chunks del workspace con similarity >= threshold MUST ser candidatos

#### Scenario: Con filtro de docType

- GIVEN una llamada con `filters: { docType: 'CONTRATO' }`
- WHEN se ejecuta la query
- THEN el SQL MUST incluir `AND metadata @> '{"docType":"CONTRATO"}'::jsonb`
- AND solo chunks con `metadata->>'docType' = 'CONTRATO'` MUST ser retornados

#### Scenario: Con filtro combinado docType + section

- GIVEN una llamada con `filters: { docType: 'CONTRATO', section: 'clausulas' }`
- WHEN se ejecuta la query
- THEN el SQL MUST incluir `AND metadata @> '{"docType":"CONTRATO","section":"clausulas"}'::jsonb`

#### Scenario: Campos undefined en filtro son ignorados

- GIVEN `filters: { docType: 'CONTRATO', section: undefined }`
- WHEN se serializa el filtro
- THEN el jsonb MUST ser `{"docType":"CONTRATO"}` (sin `section`)

#### Scenario: Filtro vacío no agrega WHERE

- GIVEN `filters: {}`
- WHEN se construye el SQL
- THEN no se agrega ningún `AND metadata @>` al WHERE
- AND el comportamiento es idéntico al de no pasar `filters`

#### Scenario: Chunks sin metadata no son excluidos por filtro aplicado

- GIVEN chunks con `metadata: null` en el workspace
- WHEN se aplica un filtro `{ docType: 'CONTRATO' }`
- THEN chunks con `metadata IS NULL` NO aparecen en el resultado (el operador `@>` no matchea NULL)
- AND esto es el comportamiento ESPERADO: chunks sin metadata no son elegibles para retrieval filtrado

#### Scenario: metadata incluida en RetrievalHit

- GIVEN una llamada exitosa a `findSimilarChunks` (con o sin filtros)
- WHEN se mapea el resultado a `RetrievalHit[]`
- THEN cada `RetrievalHit` MUST incluir el campo `metadata?: ChunkMetadata | null` con el valor del chunk

---

### Requirement: MetadataAwareRetrievalService

`MetadataAwareRetrievalService` MUST ser un `@Injectable()` NestJS service registrado en `CompletionModule`.

```typescript
detectFilters(prefix: string): MetadataFilter | null
```

- MUST retornar `null` si no hay suficiente señal en el prefijo
- MUST retornar un `MetadataFilter` parcial con los campos inferidos cuando hay señal

#### Scenario: Prefijo de contrato

- GIVEN `prefix = 'CONTRATO DE ARRENDAMIENTO\nEntre los suscritos...'`
- WHEN `detectFilters(prefix)` es llamado
- THEN MUST retornar `{ docType: 'CONTRATO' }`

#### Scenario: Prefijo de cláusula de confidencialidad

- GIVEN `prefix = 'QUINTA CLÁUSULA — CONFIDENCIALIDAD\nToda la información compartida...'`
- WHEN `detectFilters(prefix)` es llamado
- THEN MUST retornar `{ docType: 'CONTRATO', section: 'clausulas', clauseType: 'confidencialidad' }`

#### Scenario: Prefijo de demanda

- GIVEN `prefix = 'DEMANDA ORDINARIA\nEl actor, debidamente representado...'`
- WHEN `detectFilters(prefix)` es llamado
- THEN MUST retornar `{ docType: 'DEMANDA' }`

#### Scenario: Prefijo sin señal retorna null

- GIVEN `prefix = 'El día de hoy se reunieron las partes'`
- WHEN `detectFilters(prefix)` es llamado
- THEN MUST retornar `null`

#### Scenario: Prefijo corto (< minPrefixChars del retrieval gate)

- GIVEN `prefix.length < COMPLETION_CONFIG.retrievalGateMinChars`
- WHEN `detectFilters(prefix)` es llamado
- THEN MUST retornar `null` (no tiene suficiente contexto)

---

### Requirement: Fallback cuando filtros vacían el retrieval

Cuando `MetadataFilter` fue aplicado y `findSimilarChunks` retorna `[]`, el pipeline de completion MUST reintentar automáticamente **sin filtros**.

#### Scenario: Fallback transparente

- GIVEN un workspace donde todos los chunks tienen `metadata: null` (ej. documentos indexados antes del change)
- WHEN el prefijo del usuario activa un filtro `{ docType: 'CONTRATO' }`
- AND la primera llamada con filtros retorna `[]`
- THEN el pipeline MUST hacer una segunda llamada sin filtros
- AND la segunda llamada MUST retornar chunks con similarity >= threshold
- AND el usuario MUST recibir completion (no silencio)

#### Scenario: No se hace fallback si no había filtros

- GIVEN que `MetadataAwareRetrievalService.detectFilters()` retornó `null` (sin filtros)
- AND `findSimilarChunks` retorna `[]` (sin hits)
- WHEN el pipeline evalúa si hacer fallback
- THEN NO se hace una segunda llamada (ya se intentó sin filtros)
- AND el pipeline continúa con `evidence = []` al LLM path (comportamiento actual)

#### Scenario: Fallback no dispara structural match

- GIVEN que el fallback sin filtros retorna hits con similarity < 0.85
- WHEN el pipeline evalúa el structural gate
- THEN el gate NO dispara (los hits del fallback siguen siendo evaluados por threshold)
- AND el pipeline sigue el LLM path con esos hits como evidencia

---

### Requirement: Sin impacto en latencia perceptible

El costo del filtro jsonb DEBE ser absorbido por el GIN index.

- El GIN index en `metadata` MUST estar creado antes de usar filtros en producción
- En ausencia del index (ej. test environment sin migration), el sistema MUST funcionar con table scan (más lento pero correcto)
- El fallback (segunda query sin filtros) agrega una segunda round-trip a pgvector solo cuando la primera query retorna vacío — esto es un edge case infrecuente

#### Scenario: Query con GIN index es eficiente

- GIVEN un workspace con 10,000+ chunks
- WHEN se llama `findSimilarChunks` con `filters: { docType: 'CONTRATO' }`
- THEN el planner de PostgreSQL MUST usar el GIN index para filtrar por metadata ANTES del vector scan (bitmap scan + index scan)

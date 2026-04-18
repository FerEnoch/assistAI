# Proposal: structural-autocomplete

## Intent

El LLM path (500–3000ms) es la única estrategia de completion hoy. Cuando el prefijo del usuario tiene alta similitud con documentos indexados (≥ 0.85 de similitud coseno), invocar un LLM es innecesario — la respuesta ya está en el corpus. Este cambio agrega un fast-path estructural que streamea el chunk directamente, garantizando que cada completion esté anclada en documentos propios del usuario (core del MVP legal).

## Scope

### In Scope
- `StructuralMatchService` injectable en `CompletionModule`
- Gate estructural en `runPipeline()` entre retrieval y prompt assembly
- `STRUCTURAL_CONFIG` en shared: `{ similarityThreshold: 0.85, topK: 1, minPrefixChars: 100 }`
- `detectDocumentType()` en `PromptAssembler` con keywords legales en español
- SSE events: `docType` en `meta`, `structuralMatch` en `done`
- UI: `DocumentTypeBadge`, `EvidencePanel` diferenciada, `StatusBar` contextual

### Out of Scope
- Embedding classification para doc type (keyword heuristics solo)
- Caching de structural matches
- Multi-chunk assembly para structural path
- E2E tests con Playwright

## Capabilities

### New Capabilities
- `structural-match-fast-path`: Cuando similarity ≥ 0.85, el completion se sirve directo del chunk — bypass total del LLM.
- `document-type-detection`: Clasificación automática del tipo de documento legal desde el prefijo (CONTRATO, DEMANDA, ACTA, PROVIDENCIA, RESOLUCIÓN, PODER).

### Modified Capabilities
- `completion-pipeline`: Agrega gate estructural antes de invocar el LLM; reuse de `evidence[]` del pipeline principal.

## Approach

**Phase 1 — Structural Fast-Path (Backend)**

1. `STRUCTURAL_CONFIG` en shared: threshold 0.85, topK 1, minPrefixChars 100
2. `StructuralMatchService.findMatch(queryEmbedding, workspaceId)` — llama a `findSimilarChunks` con override de threshold
3. Gate en `runPipeline()` DESPUÉS de retrieval: si `evidence[0].similarity >= 0.85` → streamear chunk directo
4. **Decisión arquitectural clave**: El gate estructural reutiliza el `evidence[]` ya recuperado por el pipeline principal. NO hace segunda query pgvector. Si `evidence[0].similarity >= STRUCTURAL_CONFIG.similarityThreshold` → usa ese hit directamente.

**Phase 2 — Doc Type Detection + UI**

1. `detectDocumentType(prefix)` en `PromptAssembler` — keyword heuristics español legal
2. `docType` en SSE `meta` event
3. `structuralMatch` en SSE `done` event
4. `DocumentTypeBadge` component
5. `EvidencePanel` diferenciación visual (azul para structural, verde para LLM)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/src/config/completion.ts` | Modified | Agregado `STRUCTURAL_CONFIG` |
| `packages/shared/src/config/index.ts` | Modified | Exportado `STRUCTURAL_CONFIG` |
| `apps/api/src/completion/structural-match.service.ts` | New | Servicio para structural matching |
| `apps/api/src/completion/completion.module.ts` | Modified | Registrado `StructuralMatchService` |
| `apps/api/src/completion/completion.service.ts` | Modified | Gate estructural, streamStructuralMatch, detectDocumentType |
| `apps/api/src/completion/prompt-assembler.ts` | Modified | `detectDocumentType()` |
| `apps/web/src/editor/use-completion.ts` | Modified | Parsea `docType` y `structuralMatch` desde SSE |
| `apps/web/src/editor/use-evidence.ts` | Modified | Estado extendido con `structuralMatch` y `docType` |
| `apps/web/src/editor/DocumentTypeBadge.tsx` | New | Badge para tipo de documento |
| `apps/web/src/editor/EvidencePanel.tsx` | Modified | Diferenciación visual |
| `apps/web/src/editor/AssistEditor.tsx` | Modified | Badge + StatusBar contextual |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| False positives at 0.85 threshold | Low | TopK: 1 limita riesgo; manual QA en corpus real |
| Embedding latency | Low | Reutiliza queryEmbedding existente; +20-50ms vs LLM 500-3000ms |
| UX confusión — "de dónde vino este texto?" | Low | Evidence panel auto-open + badge de atribución |
| Short-document corpus | Low | Fallback a LLM transparente |

## Rollback Plan

- Revertir cambios en `completion.service.ts` (eliminar gate estructural)
- Eliminar `structural-match.service.ts`
- Revertir cambios en `use-completion.ts`, `use-evidence.ts`, `EvidencePanel.tsx`
- UI revertida a estado anterior — feature flag no necesario

## Dependencies

- PostgreSQL + pgvector funcionando (retrieval existente)
- SSE streaming endpoint operativo
- Embedding model configurado

## Success Criteria

- [x] Usuario con prefix similar a documento ≥ 0.85 recibe completion directo sin LLM
- [x] `isGrounded: true` siempre cuando dispara structural path
- [x] `docType` detectado y mostrado en UI
- [x] Evidence panel muestra atribución diferenciada para structural matches
- [x] 55+ tests pasando en vitest
- [x] Judgment Day aprobado (0 CRITICALs, 0 WARNINGs)

---

## Decisiones arquitecturales clave (implementadas)

1. **Gate reutiliza evidence[] del pipeline principal, NO llama a findMatch**: En lugar de hacer una segunda query pgvector, el gate evalúa `evidence[0].similarity >= 0.85`. Esto elimina el doble round-trip a la base de datos.

2. **Embedding 2048d → 1024d projection**: El modelo `nvidia/llama-nemotron-embed-vl-1b-v2:free` retorna 2048d nativos. Se proyecta a 1024d via `slice(0, 1024)` tanto en worker (indexing) como en API (query).

3. **Regexes legales en español**: `detectDocumentType` usa regexes `\bvisto\b`, `\bconsiderando\b`, `\btercero\b`, `\bcuarto\b`, etc. para PROVIDENCIA/RESOLUCIÓN.

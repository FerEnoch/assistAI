# Tasks: structural-autocomplete

## Phase 1 — Structural Match Fast-Path (Backend)

### 1. Shared Config
- [x] **T-1.1** Write test in `packages/shared/src/config/__tests__/structural-config.test.ts`: assert STRUCTURAL_CONFIG has `similarityThreshold === 0.85`, `topK === 1`, `minPrefixChars === 100`, all `as const`
- [x] **T-1.2** Add `STRUCTURAL_CONFIG` constant to `packages/shared/src/config/completion.ts` after `RETRIEVAL_CONFIG`
- [x] **T-1.3** Export `STRUCTURAL_CONFIG` from `packages/shared/src/config/index.ts`

### 2. StructuralMatchService
- [x] **T-2.1** Create `apps/api/src/completion/__tests__/structural-match.test.ts` — test: `findMatch` returns `null` when `findSimilarChunks` returns empty array
- [x] **T-2.2** Add test: `findMatch` returns the `RetrievalHit` when mock returns similarity ≥ 0.85
- [x] **T-2.3** Add test: `findMatch` returns `null` when `queryEmbedding` is empty array `[]`
- [x] **T-2.4** Add test: cross-tenant isolation — mock returns hit only for workspaceA; call with workspaceB → `null` (verify `findSimilarChunks` called with correct workspaceId)
- [x] **T-2.5** Add test: `findMatch` calls `findSimilarChunks` with `{ topK: 1, threshold: 0.85 }` options
- [x] **T-2.6** Create `apps/api/src/completion/structural-match.service.ts` with `@Injectable() StructuralMatchService`
- [x] **T-2.7** Implement `findMatch(workspaceId: string, queryEmbedding: number[]): Promise<RetrievalHit | null>` — delegates to `RetrievalService.findSimilarChunks` with structural threshold override
- [x] **T-2.8** Implement `streamTokens(subject: Subject<SseMessageEvent>, hit: RetrievalHit): void` — emits single `token` event with full `hit.content`, then `done` event with `{ completionId, latencyMs, isGrounded: true, structuralMatch: true, retrievalHits: [...] }`

### 3. CompletionModule + CompletionService Integration
- [x] **T-3.1** Write test in `apps/api/src/completion/__tests__/completion.service.integration.test.ts`: integration — when mock `findMatch` returns hit, `providerRouter.stream` is NOT called (spy called 0 times)
- [x] **T-3.2** Add test: when `findMatch` returns null, pipeline continues and `providerRouter.stream` IS called
- [x] **T-3.3** Add test: structural gate skipped when `prefix.trim().length < STRUCTURAL_CONFIG.minPrefixChars`
- [x] **T-3.4** Add test: `done` SSE event includes `structuralMatch: true` when structural path fires
- [x] **T-3.5** Register `StructuralMatchService` in `apps/api/src/completion/completion.module.ts` providers array
- [x] **T-3.6** Inject `StructuralMatchService` into `CompletionService` constructor
- [x] **T-3.7** Add structural gate in `runPipeline()` after retrieval (reutiliza `evidence[0]` del pipeline principal)
- [x] **T-3.8** Implement `private streamStructuralMatch(subject, hit, completionId, startMs): Promise<void>`
- [x] **T-3.9** Return early from `runPipeline()` after structural match fires (skip LLM invocation)

## Phase 2 — Document Type Detection + UI

### 4. Document Type Detection (API)
- [x] **T-4.1** Add tests to `apps/api/src/completion/__tests__/prompt-assembler.test.ts`: `detectDocumentType()` returns `'CONTRATO'` for prefix containing "CONTRATO DE" / "las partes acuerdan"
- [x] **T-4.2** Add test: returns `'DEMANDA'` for "demanda", "actor", "demandado"
- [x] **T-4.3** Add test: returns `'ACTA'` for "acta", "reunión", "sesión"
- [x] **T-4.4** Add test: returns `'PROVIDENCIA'` for "providencia", "juzgado", "autos y vistos"
- [x] **T-4.5** Add test: returns `'RESOLUCIÓN'` for "resolución", "visto", "considerando"
- [x] **T-4.6** Add test: returns `null` for unrecognized plain text
- [x] **T-4.7** Implement `detectDocumentType(prefix: string): string | null` in `apps/api/src/completion/prompt-assembler.ts`
- [x] **T-4.8** Call `detectDocumentType` in `runPipeline()` alongside `assemblePrompt`, store result as `docType`
- [x] **T-4.9** Add `docType?: string | null` to the `meta` SSE event payload in `runPipeline()` (both structural and LLM paths)

### 5. SSE Client Updates (Frontend)
- [x] **T-5.1** Extend `EvidenceState` interface in `apps/web/src/editor/use-evidence.ts`: add `structuralMatch: boolean` and `docType: string | null`
- [x] **T-5.2** Update `updateEvidence` callback signature + `setEvidence` call in `useEvidence` to accept and store `structuralMatch` and `docType`
- [x] **T-5.3** Update initial state in `useEvidence`: `structuralMatch: false, docType: null`
- [x] **T-5.4** Update `clearEvidence` in `useEvidence` to reset `structuralMatch: false, docType: null`
- [x] **T-5.5** Update `UseCompletionOptions.onEvidenceReceived` type in `apps/web/src/editor/use-completion.ts` to include `structuralMatch?: boolean`
- [x] **T-5.6** In `processSseEvent`, parse `docType` from `meta` event and store in a local ref
- [x] **T-5.7** In `processSseEvent`, parse `structuralMatch` from `done` event and pass it through `onEvidenceReceived`

### 6. UI Components
- [x] **T-6.1** Create `apps/web/src/editor/DocumentTypeBadge.tsx`: chip component, accepts `docType: string | null`, renders pill with uppercase label + `var(--accent-default)` border/color, returns `null` when `docType` is null
- [x] **T-6.2** Add `DocumentTypeBadge` to `AssistEditor.tsx` toolbar area: pass `evidence.docType`, render inside `StatusBar` row left-aligned before status text
- [x] **T-6.3** Pass `structuralMatch` and `docType` from `evidence` through `EvidencePanel` props; add to `EvidencePanelProps` interface
- [x] **T-6.4** Update `EvidencePanel` grounding badge: when `structuralMatch === true`, show "Completando desde tu documento: {title}" with `var(--accent-blue, #3b82f6)` accent; else keep existing green logic
- [x] **T-6.5** Update `EvidenceHitCard` in `EvidencePanel`: when hit is structural, show "📋 Estructura directa" as type label and apply `borderLeft: '3px solid var(--accent-blue, #3b82f6)'`
- [x] **T-6.6** Update `StatusBar` in `AssistEditor.tsx`: when `status === 'streaming' && structuralMatch`, show "Completando con estructura de: {documentTitle}" with blue `borderLeftColor`

---

## Implementation Order

```
T-1.1 → T-1.2 → T-1.3 (config)
T-2.1 → T-2.2 → T-2.3 → T-2.4 → T-2.5 → T-2.6 → T-2.7 → T-2.8 (service)
T-3.1 → T-3.2 → T-3.3 → T-3.4 → T-3.5 → T-3.6 → T-3.7 → T-3.8 → T-3.9 (integration)
T-4.1 → T-4.2 → T-4.3 → T-4.4 → T-4.5 → T-4.6 → T-4.7 → T-4.8 → T-4.9 (docType)
T-5.1 → T-5.2 → T-5.3 → T-5.4 → T-5.5 → T-5.6 → T-5.7 (frontend client)
T-6.1 → T-6.2 → T-6.3 → T-6.4 → T-6.5 → T-6.6 (UI)
```

**Total: 42 tasks** across 6 phases.

## Judgment Day Fixes Applied

| Fix | Description |
|-----|-------------|
| CRITICAL #1 | `streamStructuralMatch`: DB ops post-`done` envueltos en try/catch — previene double terminal (done+error) |
| CRITICAL #2 | Gate estructural reutiliza `evidence[0]` en lugar de llamar `findMatch` — elimina doble pgvector round-trip |
| WARNING #4 | Guard `if (timedOut || signal?.aborted) return` antes de `streamStructuralMatch` |
| WARNING #5 | `StructuralMatchService.findMatch` usa `STRUCTURAL_CONFIG.topK` / `.similarityThreshold` en lugar de valores hardcodeados |
| WARNING #7 | Regex `\bvisto\b` reemplazado por regexes más específicos para PROVIDENCIA/RESOLUCIÓN |
| WARNING #9 | `trackedCompletionIdRef` en `useEvidence` previene analytics duplicados |

**Resultado: 55 tests pasando, TypeScript limpio, cero regresiones.**

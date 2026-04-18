# Design: structural-autocomplete

## Technical Approach

Two-phase feature que intercepta el completion pipeline DESPUÉS del embedding + retrieval, ANTES de invocar el LLM. Cuando un chunk de documento tiene similarity ≥ 0.85 con el prefijo, streamea el chunk directamente como tokens SSE — bypass total del LLM.

Phase 1: Fast-path estructural.
Phase 2: Document type detection + UI attribution.

No se usa estado global — se extiende el estado existente de `useCompletion` y `useEvidence`.

## Arquitectura de decisiones

| Decisión | Opción | Alternativas | Justificación |
|----------|--------|-------------|----------------|
| Structural gate location | Reutiliza `evidence[]` del pipeline principal | Nueva query `findSimilarChunks` con threshold 0.85 | Elimina doble pgvector round-trip. Si `evidence[0].similarity >= 0.85` → usa ese hit directamente. |
| Document type detection | Keyword heuristics | Embedding classification | O(n×m) string match, zero latency, determinístico, suficiente para legal domain |
| Streaming strategy | Un solo token con el chunk completo | Token-by-token con delay | "Paste from document" no necesita feeling de typeahead |
| UI differentiation | Badge + color azul para structural | Icono, tooltip | Visualmente claro vs LLM (verde) |
| Testing strategy | Unit tests para service + integration tests para pipeline | E2E con Playwright | Proyecto usa vitest, no E2E en MVP |

## Data Flow

```
User types prefix
        │
        ▼
runPipeline() ──► [shouldSkipRetrieval gate]
        │
        ▼
embed(prefix) ──► queryEmbedding (2048d → slice(0,1024))
        │
        ▼
findSimilarChunks(workspaceId, queryEmbedding, { topK: 4, threshold: 0.72 })
        │
        ▼
evidence[] = hits
        │
        ▼
GATE: if (evidence[0]?.similarity >= 0.85 && prefix.length >= 100)
        │
        ├─► STRUCTURAL PATH ──► streamStructuralMatch() ──► emit token + done(isGrounded: true, structuralMatch: true)
        │                                                                                              │
        │                                                                                              ▼
        │                                                                                     RETURN EARLY
        │
        └─► LLM PATH ──► detectDocumentType(prefix) ──► assemblePrompt ──► providerRouter.stream()
                                                                                    │
                                                                                    ▼
                                                                        emit meta(docType) + done(isGrounded, structuralMatch: false)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/config/completion.ts` | Modify | Agregado `STRUCTURAL_CONFIG` |
| `packages/shared/src/config/index.ts` | Modify | Exportado `STRUCTURAL_CONFIG` |
| `apps/api/src/completion/structural-match.service.ts` | Create | Servicio para structural matching con tests |
| `apps/api/src/completion/completion.module.ts` | Modify | Registrado `StructuralMatchService` |
| `apps/api/src/completion/completion.service.ts` | Modify | Gate estructural, streamStructuralMatch, detectDocumentType, docType en meta |
| `apps/api/src/completion/prompt-assembler.ts` | Modify | `detectDocumentType()` con regexes legales |
| `apps/api/src/completion/__tests__/structural-match.test.ts` | Create | 8 tests unitarios |
| `apps/api/src/completion/__tests__/completion.service.integration.test.ts` | Create | 6 tests de integración |
| `apps/api/src/completion/__tests__/prompt-assembler.test.ts` | Modify | 30 tests (17 nuevos para detectDocumentType) |
| `apps/web/src/editor/use-completion.ts` | Modify | Parsea docType de meta, structuralMatch de done |
| `apps/web/src/editor/use-evidence.ts` | Modify | Estado extendido: structuralMatch + docType |
| `apps/web/src/editor/DocumentTypeBadge.tsx` | Create | Badge para tipo de documento |
| `apps/web/src/editor/EvidencePanel.tsx` | Modify | Diferenciación visual (azul structural, verde LLM) |
| `apps/web/src/editor/AssistEditor.tsx` | Modify | DocumentTypeBadge + StatusBar contextual |
| `packages/shared/src/config/__tests__/structural-config.test.ts` | Create | Tests de config |

## Interfaces / Contracts

```typescript
// Shared config
export const STRUCTURAL_CONFIG = {
  similarityThreshold: 0.85,
  topK: 1,
  minPrefixChars: 100,
} as const;
```

```typescript
// SSE meta event
interface SseMetaEvent {
  type: 'meta';
  docType?: string | null;  // 'contrato' | 'demanda' | 'acta' | 'providencia' | 'resolucion' | 'poder' | null
  completionId: string;
  // ...existing fields
}

// SSE done event  
interface SseDoneEvent {
  type: 'done';
  completionId: string;
  latencyMs: number;
  isGrounded: boolean;
  structuralMatch: boolean;  // true cuando viene del fast-path estructural
  retrievalHits: RetrievalHit[];
  // ...existing fields
}
```

```typescript
// use-evidence.ts state extension
interface EvidenceState {
  hits: RetrievalHit[];
  isOpen: boolean;
  isLoading: boolean;
  structuralMatch: boolean;  // NEW
  docType: string | null;     // NEW
}
```

## Testing Strategy

| Layer | What | Approach |
|------|------|----------|
| Unit | `STRUCTURAL_CONFIG` values | Direct assertion on const |
| Unit | `StructuralMatchService.findMatch` | Mock `findSimilarChunks`, test null/hit/threshold/cross-tenant |
| Unit | `detectDocumentType` | 17 tests cubriendo todos los tipos legales + null |
| Integration | Pipeline gate | Mock `findMatch` return, verify provider NOT called |
| Integration | Pipeline fallback | Mock `findMatch` null, verify provider IS called |
| Integration | SSE events | Verify `docType` en meta, `structuralMatch` en done |

## Migration / Rollout

- **No DB migration needed**: Solo config + lógica
- **No breaking changes**: El gate es aditivo; si no hay match, sigue LLM path
- **Rollback**: Revertir cambios en completion.service.ts + eliminar structural-match.service.ts

## Open Questions

- [x] Threshold 0.85 — ¿es demasiado alto o bajo? → Start conservative; ajustar según corpus real
- [x] Keyword heuristics vs embedding → Keyword sufficient para legal domain MVP

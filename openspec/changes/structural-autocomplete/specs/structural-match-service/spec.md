# Structural Match Service Specification

## Purpose

Define el comportamiento de `StructuralMatchService` — el servicio injectable que determina si un completion puede ser servido directamente desde un chunk de documento sin invocar el LLM.

---

## Requirements

### Requirement: STRUCTURAL_CONFIG constant

`STRUCTURAL_CONFIG` MUST be exported from `packages/shared/src/config/completion.ts` as an `as const` object with the following required fields and defaults.

| Field | Type | Required default |
|---|---|---|
| `similarityThreshold` | `number` | `0.85` |
| `topK` | `number` | `1` |
| `minPrefixChars` | `number` | `100` |

`minPrefixChars` MUST be strictly greater than the base LLM retrieval gate minimum prefix length (50).

#### Scenario: Config values enforced at compile time

- GIVEN `STRUCTURAL_CONFIG` is imported in `StructuralMatchService`
- WHEN `findSimilarChunks` is called
- THEN it MUST use `STRUCTURAL_CONFIG.similarityThreshold` and `STRUCTURAL_CONFIG.topK`

#### Scenario: minPrefixChars gate

- GIVEN a completion request where `prefix.length < STRUCTURAL_CONFIG.minPrefixChars`
- WHEN the structural gate is evaluated
- THEN the gate MUST skip structural matching and return `null` (no embedding call made)

---

### Requirement: Structural Hit Detection

`StructuralMatchService.findMatch(queryEmbedding, workspaceId)` MUST call `findSimilarChunks({ topK: 1, similarityThreshold: 0.85, workspaceId })` and return the top chunk when similarity ≥ 0.85, or `null` otherwise.

#### Scenario: High-similarity match found

- GIVEN a workspace with indexed chunks and a valid `queryEmbedding`
- WHEN the top chunk has similarity ≥ 0.85
- THEN the service MUST return that chunk as a structural hit

#### Scenario: Low-similarity — fallback to LLM

- GIVEN a workspace with indexed chunks and a valid `queryEmbedding`
- WHEN the top chunk has similarity < 0.85
- THEN the service MUST return `null`

#### Scenario: Null embedding — skip silently

- GIVEN `queryEmbedding` is `null` or empty array
- WHEN `findMatch` is called
- THEN the service MUST return `null` without throwing or logging an error

#### Scenario: No indexed chunks in workspace

- GIVEN a workspace with zero indexed chunks
- WHEN `findMatch` is called with a valid embedding
- THEN the service MUST return `null` gracefully (no error thrown)

#### Scenario: Cross-tenant isolation

- GIVEN two workspaces A and B, each with indexed chunks
- WHEN `findMatch` is called with `workspaceId = A`
- THEN the service MUST NOT return chunks belonging to workspace B

---

### Requirement: Token Streaming

`streamTokens(subject, hit)` MUST emit a single SSE `token` event containing the full `hit.content`, followed by a `done` event with grounding metadata.

#### Scenario: Token emission

- GIVEN a valid `RetrievalHit` from `findMatch`
- WHEN `streamTokens` is called
- THEN a single SSE `token` event MUST be emitted with the chunk content
- AND a `done` event MUST follow with `isGrounded: true`, `structuralMatch: true`, and `retrievalHits` populated

---

### Requirement: Error Handling

DB operations post-`done` emission MUST be wrapped in try/catch to prevent double terminal events (done + error).

#### Scenario: DB error after done

- GIVEN the SSE `done` event was already emitted
- WHEN `persistRetrievalHits` or any post-done DB operation fails
- THEN the error MUST be caught and logged
- AND no additional SSE event MUST be emitted

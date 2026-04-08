# Evidence Panel Attribution Specification

## Purpose

Define cómo la UI muestra atribución diferenciada para structural matches vs LLM-generated completions.

---

## Requirements

### Requirement: Structural Hit Attribution in EvidencePanel

When `structuralMatch: true` is received in the SSE `done` event, the `EvidencePanel` MUST display the source document title and an attribution label in Spanish (Rioplatense).

#### Scenario: Structural match — attribution shown

- GIVEN the SSE `done` event contains `structuralMatch: true`
- WHEN `EvidencePanel` renders
- THEN it MUST show the source document title
- AND MUST show attribution copy in Spanish: "Completando desde tu documento: {title}"
- AND MUST visually differentiate structural hits from LLM-generated hits (blue accent)

#### Scenario: LLM hit — no structural attribution

- GIVEN the SSE `done` event contains `structuralMatch: false` or field is absent
- WHEN `EvidencePanel` renders
- THEN it MUST NOT show structural attribution copy
- AND MUST use green accent for LLM-generated hits

### Requirement: EvidenceHitCard Visual Differentiation

The `EvidenceHitCard` component MUST show a distinct type label and border for structural matches.

#### Scenario: Structural hit card styling

- GIVEN a hit with `structuralMatch: true`
- WHEN the card renders
- THEN it MUST show "📋 Estructura directa" as type label
- AND MUST apply a blue left border (`3px solid #3b82f6`)

#### Scenario: LLM hit card styling

- GIVEN a hit with `structuralMatch: false` or absent
- WHEN the card renders
- THEN it MUST show "Documento" as type label
- AND MUST NOT apply the structural blue border

### Requirement: DocumentTypeBadge Lifecycle

`DocumentTypeBadge` MUST appear in the editor toolbar when `docType` is not `null`, and MUST disappear when the user starts a new completion request (docType reset to `null`).

#### Scenario: Badge shown on docType detection

- GIVEN the SSE `meta` event delivers a non-null `docType`
- WHEN the editor toolbar renders
- THEN `DocumentTypeBadge` MUST be visible with the document type label in Spanish (uppercase)

#### Scenario: Badge hidden on new completion

- GIVEN `DocumentTypeBadge` is currently visible
- WHEN the user triggers a new completion request
- THEN `docType` MUST be reset to `null`
- AND `DocumentTypeBadge` MUST no longer be rendered

### Requirement: StatusBar Contextual Text

The `StatusBar` MUST display contextual status text based on whether the completion is structural or LLM-generated.

#### Scenario: Structural streaming status

- GIVEN `status === 'streaming'` AND `structuralMatch === true`
- WHEN the StatusBar renders
- THEN it MUST display "Completando con estructura de: {documentTitle}" with blue accent

#### Scenario: LLM streaming status

- GIVEN `status === 'streaming'` AND `structuralMatch === false` or absent
- WHEN the StatusBar renders
- THEN it MUST display "Generando sugerencia..." with default accent

# Document Type Detection Specification

## Purpose

Define cómo el sistema detecta automáticamente el tipo de documento legal desde el prefijo del texto del usuario, usando keyword heuristics en español.

---

## Requirements

### Requirement: detectDocumentType Keyword Heuristics

`PromptAssembler.detectDocumentType(prefix: string)` MUST classify the prefix into one of the recognized Spanish legal document types or return `null`.

Recognized types (MUST cover at minimum): `contrato`, `demanda`, `acta`, `providencia`, `resolucion`, `poder`.

Matching SHOULD be case-insensitive. The function MUST return `null` when no type is detected — this is not an error condition.

#### Scenario: CONTRATO detected

- GIVEN a prefix containing "CONTRATO DE" or "las partes acuerdan" or "cláusula"
- WHEN `detectDocumentType` is called
- THEN it MUST return `"CONTRATO"`

#### Scenario: DEMANDA detected

- GIVEN a prefix containing "demanda", "actor", "demandado", "juicio"
- WHEN `detectDocumentType` is called
- THEN it MUST return `"DEMANDA"`

#### Scenario: ACTA detected

- GIVEN a prefix containing "acta", "reunión", "sesión", "asistentes"
- WHEN `detectDocumentType` is called
- THEN it MUST return `"ACTA"`

#### Scenario: PROVIDENCIA detected

- GIVEN a prefix containing "providencia", "juzgado", "autos y vistos", "a la causa"
- WHEN `detectDocumentType` is called
- THEN it MUST return `"PROVIDENCIA"`

#### Scenario: RESOLUCIÓN detected

- GIVEN a prefix containing "resolución", "visto", "considerando", "por ello"
- WHEN `detectDocumentType` is called
- THEN it MUST return `"RESOLUCIÓN"`

#### Scenario: PODER detected

- GIVEN a prefix containing "poder", "para represents", "avio"
- WHEN `detectDocumentType` is called
- THEN it MUST return `"PODER"`

#### Scenario: No recognizable type

- GIVEN a prefix with no recognized legal document keywords
- WHEN `detectDocumentType` is called
- THEN it MUST return `null` (no exception thrown)

#### Scenario: Case-insensitive matching

- GIVEN a prefix containing "Demanda" (mixed case)
- WHEN `detectDocumentType` is called
- THEN it MUST return `"DEMANDA"`

---

### Requirement: docType in SSE meta event

When `detectDocumentType` returns a non-null value, the pipeline MUST include `docType` in the SSE `meta` event.

#### Scenario: docType in meta event

- GIVEN `detectDocumentType` returns `"CONTRATO"`
- WHEN the pipeline emits the SSE `meta` event
- THEN the `meta` event MUST include `docType: "CONTRATO"`

#### Scenario: null docType in meta event

- GIVEN `detectDocumentType` returns `null`
- WHEN the pipeline emits the SSE `meta` event
- THEN the `docType` field MUST be omitted or set to `null`

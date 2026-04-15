# Spec: metadata-extraction

## Purpose

Definir el comportamiento de `MetadataExtractor`, el servicio injectable del worker responsable de extraer `ChunkMetadata` de cada chunk durante la indexación de documentos.

---

## Requirements

### Requirement: MetadataExtractor injectable

`MetadataExtractor` MUST ser un `@Injectable()` NestJS service registrado en `IndexingModule`. MUST ser inyectable en `IndexingWorker`.

La API pública es un único método:

```typescript
extract(content: string, docHint?: string): ChunkMetadata
```

- `content`: texto del chunk (máx ~500 tokens)
- `docHint`: tipo de documento del nivel superior si ya fue detectado (para mejorar precisión de sección y clauseType)
- Retorno: `ChunkMetadata` completo — NUNCA lanza excepciones; retorna defaults seguros si el matching falla

#### Scenario: Extracción sin errores para cualquier input

- GIVEN cualquier string como `content`, incluyendo string vacío
- WHEN se llama `extract(content)`
- THEN MUST retornar un `ChunkMetadata` válido sin lanzar excepción
- AND los campos de union type MUST ser `null` si no hay match
- AND `tags` MUST ser `[]` si no hay keywords relevantes
- AND `isTemplate` MUST ser `false`, `sourceTemplateId` MUST ser `null`

---

### Requirement: Detección de docType

La detección de `docType` MUST usar pattern matching case-insensitive sobre el contenido del chunk.

| Pattern (regex) | `docType` resultante |
|-----------------|---------------------|
| `/contrato\s+de\|las\s+partes\s+acuerdan/i` | `'CONTRATO'` |
| `/\bdemanda\b\|\bactor\b\|\bdemandado\b/i` | `'DEMANDA'` |
| `/\bacta\b\|reuni[oó]n\|sesi[oó]n/i` | `'ACTA'` |
| `/providencia\|juzgado\|autos\s+y\s+vistos/i` | `'PROVIDENCIA'` |
| `/resoluci[oó]n\|visto\s+y\s+considerando\|vistos\s+los/i` | `'RESOLUCIÓN'` |
| `/\bpoder\s+notarial\b\|\bpoderdante\b\|\bapoderado\b/i` | `'PODER'` |
| (ningún pattern) | `null` |

#### Scenario: `docHint` como desempate

- GIVEN `docHint = 'CONTRATO'` y `content` sin patrones de docType
- WHEN `extract(content, 'CONTRATO')` es llamado
- THEN `docType` MUST ser `'CONTRATO'` (el hint prevalece cuando el chunk no tiene patrones propios)

#### Scenario: Patrón en chunk prevalece sobre hint

- GIVEN `docHint = 'CONTRATO'` y content con keywords de "demanda" / "actor"
- WHEN `extract(content, 'CONTRATO')` es llamado
- THEN `docType` MUST ser `'DEMANDA'` (el patrón en el chunk es más específico que el hint)

---

### Requirement: Detección de section

La detección de `section` MUST usar los siguientes patterns case-insensitive:

| Pattern (regex) | `section` resultante |
|-----------------|---------------------|
| `/entre\s+los\s+suscritos\|comparecen\|identificaci[oó]n\s+de\s+las\s+partes\|datos\s+del\s+contratante/i` | `'encabezado'` |
| `/((primera\|segunda\|tercera\|cuarta\|quinta)\s+(cl[aá]usula)\|(cl[aá]usula)\s+(primera\|segunda\|tercera\|cuarta))/i` | `'clausulas'` |
| `/considerando[:\s]\|que\s+el\s+demandante\|que\s+con\s+fecha/i` | `'considerandos'` |
| `/\bresuelve:\|\bfalla:\|se\s+resuelve:\|\bfallo:/i` | `'fallo'` |
| (ningún patrón estructural) | `null` |

#### Scenario: Prioridad de sección cuando hay múltiples matches

- GIVEN un chunk con "PRIMERA CLÁUSULA: CONSIDERACIONES GENERALES"
- WHEN se detecta la sección
- THEN `section` MUST ser `'clausulas'` (las cláusulas tienen prioridad sobre considerandos cuando hay conflicto de patterns)

---

### Requirement: Detección de clauseType

`clauseType` solo MUST ser no-null cuando `section === 'clausulas'`. En cualquier otro caso MUST ser `null`.

| Pattern (regex) | `clauseType` resultante |
|-----------------|------------------------|
| `/informaci[oó]n\s+confidencial\|secreto\s+comercial\|caracter\s+confidencial/i` | `'confidencialidad'` |
| `/cl[aá]usula\s+penal\|multa\s+de\|penalizaci[oó]n\|incumplimiento/i` | `'penalidad'` |
| `/fuerza\s+mayor\|caso\s+fortuito\|eventos\s+de\s+fuerza/i` | `'fuerza_mayor'` |
| `/objeto\s+del\s+contrato\|tiene\s+por\s+objeto\|se\s+compromete\s+a/i` | `'objeto'` |
| `/duraci[oó]n\|plazo\s+del\s+contrato\|vigencia\s+del/i` | `'duracion'` |
| `/forma\s+de\s+pago\|precio\s+del\s+contrato\|remuneraci[oó]n/i` | `'pago'` |
| (ningún pattern) | `null` |

#### Scenario: clauseType nunca se aplica fuera de sección de cláusulas

- GIVEN un chunk con "información confidencial" en `section: 'encabezado'`
- WHEN se extrae la metadata
- THEN `clauseType` MUST ser `null`

---

### Requirement: Extracción de tags

`tags` MUST ser un array de hasta **10 strings** de keywords relevantes extraídas del chunk.

- Tags MUST ser en **minúsculas**
- Solo incluir palabras de dominio legal (no artículos, preposiciones, verbos genéricos)
- Extraer de una lista de ~50 keywords legales conocidas: "responsabilidad", "indemnización", "obligación", "contraprestación", "rescisión", "nulidad", "mora", "plazo", "garantía", etc.
- Si el chunk no contiene ninguna keyword de la lista, `tags` MUST ser `[]`

#### Scenario: Extracción de tags relevantes

- GIVEN un chunk con "En caso de incumplimiento, la parte en mora deberá pagar una indemnización..."
- WHEN se extraen los tags
- THEN `tags` MUST contener `["incumplimiento", "mora", "indemnización"]` (puede contener más, máximo 10)

#### Scenario: Máximo 10 tags

- GIVEN un chunk con muchas keywords legales
- WHEN se extraen los tags
- THEN `tags.length` MUST ser ≤ 10

---

### Requirement: Integración en IndexingWorker

`IndexingWorker` MUST llamar a `MetadataExtractor.extract()` por cada chunk procesado antes de persistir en base de datos.

#### Scenario: Chunk persistido con metadata

- GIVEN un documento siendo indexado
- WHEN se procesa cada chunk
- THEN `MetadataExtractor.extract(chunk.content)` MUST ser llamado
- AND el resultado MUST ser asignado a `chunk.metadata` antes del INSERT

#### Scenario: Error en extracción no detiene indexing

- GIVEN que `MetadataExtractor.extract()` lanza una excepción inesperada
- WHEN el worker procesa el chunk
- THEN el chunk MUST ser persistido con `metadata: null` (no propagar el error)
- AND un warning MUST ser logueado con el mensaje de error

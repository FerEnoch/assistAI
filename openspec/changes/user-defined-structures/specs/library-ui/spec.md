# Spec: library-ui

## Purpose

Definir el comportamiento y los contratos de UI de la página **Mi Biblioteca** (`/library`): stats del corpus, listado de templates, y formulario de creación/edición.

---

## Requirements

### Requirement: Ruta /library accesible y autenticada

La ruta `/library` MUST estar registrada en `App.tsx` y protegida por autenticación (misma guarda que el editor).

#### Scenario: Acceso directo sin sesión

- GIVEN un usuario no autenticado
- WHEN navega a `/library`
- THEN MUST ser redirigido a `/login`

#### Scenario: Navegación desde el editor

- GIVEN un usuario autenticado en el editor
- WHEN hace click en el link "Mi Biblioteca" (en navbar o sidebar)
- THEN MUST navegar a `/library` sin recargar la app

---

### Requirement: LibraryStats — stats del corpus

El componente `LibraryStats` MUST mostrarse al inicio de la página, con datos del workspace actual.

| Stat | Descripción |
|------|-------------|
| **Documentos indexados** | Total de documentos del workspace en DB |
| **Fragmentos totales** | Total de chunks en `document_chunks` del workspace |
| **Mis plantillas** | Cantidad de templates activos del workspace |
| **Por tipo de documento** | Breakdown: CONTRATO: N, DEMANDA: N, etc. — solo tipos con count > 0 |

#### Scenario: Workspace sin documentos

- GIVEN un workspace recién creado sin documentos ni templates
- WHEN se carga `LibraryStats`
- THEN MUST mostrar `0` en todos los contadores
- AND el breakdown por tipo MUST estar vacío (o mostrar mensaje "Sin documentos aún")

#### Scenario: Datos cargando

- GIVEN que `GET /library/stats` está en vuelo
- WHEN el componente está cargando
- THEN MUST mostrar skeleton loaders en lugar de los contadores

---

### Requirement: TemplateList — listado de templates

El componente `TemplateList` MUST mostrar todos los templates del workspace con acciones CRUD.

Cada item de template MUST mostrar:
- Nombre del template
- Badge de docType (si tiene) — misma estética que `DocumentTypeBadge` del editor
- Cantidad de secciones (`N secciones`)
- Botón **Editar** → abre `TemplateFormModal` con datos pre-cargados
- Botón **Eliminar** → muestra confirmación antes de ejecutar DELETE

#### Scenario: Workspace sin templates

- GIVEN un workspace sin templates creados
- WHEN se carga `TemplateList`
- THEN MUST mostrar un empty state con mensaje "No tenés plantillas aún" y botón "Crear primera plantilla"

#### Scenario: Eliminar template — confirmación requerida

- GIVEN un template existente en la lista
- WHEN el usuario hace click en "Eliminar"
- THEN MUST aparecer un diálogo de confirmación: "¿Eliminar '[nombre]'? Esta acción no se puede deshacer."
- AND el template MUST eliminarse SOLO si el usuario confirma
- AND la lista MUST actualizarse inmediatamente (optimistic update o re-fetch)

#### Scenario: Feedback visual al crear/editar

- GIVEN el usuario guarda un template desde el formulario
- WHEN la operación es exitosa
- THEN el modal MUST cerrarse
- AND la lista MUST actualizarse con el template nuevo/editado
- AND MUST mostrarse un toast/mensaje de confirmación: "Plantilla guardada"

---

### Requirement: TemplateFormModal — formulario crear/editar

El modal MUST permitir crear y editar templates con todas sus secciones.

#### Campos del formulario raíz:
- **Nombre** (requerido): input text, placeholder "ej. Contrato de Servicios Profesionales"
- **Descripción** (opcional): textarea, placeholder "Descripción opcional de cuándo usar esta plantilla"
- **Tipo de documento** (opcional): select con opciones CONTRATO, DEMANDA, ACTA, PROVIDENCIA, RESOLUCIÓN, PODER, (sin tipo)

#### Secciones — lista dinámica:
- Botón **"Agregar sección"** — agrega una sección al final
- Cada sección tiene:
  - **Nombre de sección** (requerido): input, placeholder "ej. Cláusula de Confidencialidad"
  - **Tipo de cláusula** (opcional): select con `ClauseType` values
  - **Contenido de ejemplo** (opcional): textarea, placeholder "Pegá aquí texto representativo de esta sección (mínimo 100 caracteres recomendado)"
  - Botón **eliminar sección** (✕)
- Mínimo 0 secciones; máximo 20 secciones

#### Scenario: Formulario de creación en blanco

- GIVEN el usuario hace click en "Crear plantilla"
- WHEN el modal se abre
- THEN todos los campos MUST estar vacíos / en su valor default
- AND MUST existir al menos una sección vacía pre-cargada para que el usuario empiece a tipear

#### Scenario: Formulario de edición pre-cargado

- GIVEN un template existente con nombre y secciones
- WHEN el usuario hace click en "Editar"
- THEN el modal MUST abrirse con todos los campos pre-cargados con los datos del template
- AND las secciones MUST mostrarse en su orden original

#### Scenario: Validación — nombre requerido

- GIVEN el usuario intenta guardar con el campo "Nombre" vacío
- WHEN hace click en "Guardar"
- THEN MUST mostrarse error inline en el campo "Nombre": "El nombre es requerido"
- AND el formulario MUST NO enviarse al backend

#### Scenario: Sección sin contenido de ejemplo

- GIVEN una sección con nombre pero sin `sampleContent`
- WHEN el template se guarda
- THEN la sección MUST persistirse (en `template_sections`)
- AND NO MUST indexarse como chunk (sin embedding)
- AND MUST mostrarse un aviso sutil: "Esta sección no generará sugerencias (sin contenido de ejemplo)"

---

### Requirement: LibraryStats endpoint — GET /library/stats

El endpoint `GET /library/stats` MUST retornar:

```typescript
interface LibraryStatsDto {
  totalDocuments: number;    // COUNT DISTINCT document_id FROM document_chunks WHERE workspace_id = ?
  totalChunks: number;       // COUNT FROM document_chunks WHERE workspace_id = ? AND metadata->>'isTemplate' IS NULL
  totalTemplates: number;    // COUNT FROM templates WHERE workspace_id = ? AND is_active = true
  docTypeBreakdown: Record<string, number>;  // metadata->>'docType' GROUP BY
}
```

#### Scenario: Chunks de templates no cuentan en totalChunks

- GIVEN un workspace con 100 chunks de documentos y 10 chunks de templates
- WHEN `GET /library/stats` es llamado
- THEN `totalChunks` MUST ser `100` (chunks de templates excluidos)
- AND `totalTemplates` MUST ser el número de templates activos

#### Scenario: Auth requerida

- GIVEN un request sin JWT válido
- WHEN `GET /library/stats` es llamado
- THEN MUST retornar `401 Unauthorized`

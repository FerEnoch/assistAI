## ADDED Requirements

### Requirement: Tabla de join template_documents vincula templates con documentos
El sistema SHALL mantener una tabla `template_documents` con `template_id` y `document_id` como PK compuesta. Un documento puede estar asociado a múltiples templates. La eliminación de un template o documento CASCADE-elimina sus asociaciones.

#### Scenario: Asociación creada al crear template desde archivo
- **WHEN** un template es creado desde upload o desde Drive
- **THEN** se crea automáticamente una fila en `template_documents` vinculando el documento al template

#### Scenario: Cascade delete al eliminar template
- **WHEN** el usuario elimina un template
- **THEN** las filas de `template_documents` con ese `template_id` son eliminadas
- **THEN** los documentos referenciados NO son eliminados (solo la asociación)

#### Scenario: Cascade delete al eliminar documento
- **WHEN** un documento es eliminado del workspace
- **THEN** las filas de `template_documents` con ese `document_id` son eliminadas automáticamente

### Requirement: El usuario puede asociar un documento existente a un template
El sistema SHALL permitir al usuario agregar un documento ya indexado en el workspace a un template desde la vista de detail del template.

#### Scenario: Asociación exitosa
- **WHEN** el usuario selecciona "Agregar documento" en la vista de corpus de un template
- **AND** selecciona un documento del workspace que aún no está asociado al template
- **THEN** el sistema crea la asociación en `template_documents`
- **THEN** el documento aparece en la lista de corpus del template

#### Scenario: Documento ya asociado no aparece como opción
- **WHEN** el usuario abre el selector de documentos para un template
- **THEN** los documentos ya asociados a ese template NO aparecen como opción seleccionable

### Requirement: El usuario puede desasociar un documento de un template
El sistema SHALL permitir al usuario eliminar la asociación entre un documento y un template sin eliminar el documento del workspace.

#### Scenario: Desasociación exitosa
- **WHEN** el usuario hace click en "Quitar" sobre un documento en la lista de corpus de un template
- **AND** confirma la acción
- **THEN** el sistema elimina la fila correspondiente de `template_documents`
- **THEN** el documento desaparece de la lista de corpus del template
- **THEN** el documento sigue existiendo en el workspace

### Requirement: La UI muestra el corpus de documentos agrupado por template
El sistema SHALL mostrar, para cada template en Library, cuántos documentos tiene asociados y su estado de ingest.

#### Scenario: Template sin documentos asociados
- **WHEN** un template no tiene documentos en `template_documents`
- **THEN** la card del template muestra "Sin corpus"
- **THEN** se muestra un CTA "Agregar documentos"

#### Scenario: Template con documentos asociados
- **WHEN** un template tiene documentos asociados
- **THEN** la card del template muestra el conteo: "N documentos"
- **THEN** al expandir el template, se muestra la lista de documentos con nombre y estado (indexado / procesando / fallido)

### Requirement: APIs REST para gestión del corpus de un template
El sistema SHALL exponer los siguientes endpoints para gestionar documentos asociados a un template:

- `GET /templates/:id/documents` — lista documentos asociados
- `POST /templates/:id/documents` — asociar documento existente (`{ documentId: string }`)
- `DELETE /templates/:id/documents/:docId` — desasociar

#### Scenario: GET retorna lista de documentos asociados
- **WHEN** el cliente llama `GET /templates/:id/documents` con un template del workspace del usuario
- **THEN** el servidor responde `200 OK` con array de documentos (id, title, ingestStatus, createdAt)

#### Scenario: POST asocia un documento
- **WHEN** el cliente llama `POST /templates/:id/documents` con `{ documentId }` válido
- **THEN** el servidor responde `201 Created`
- **THEN** la asociación existe en `template_documents`

#### Scenario: DELETE desasocia un documento
- **WHEN** el cliente llama `DELETE /templates/:id/documents/:docId`
- **THEN** el servidor responde `204 No Content`
- **THEN** la fila en `template_documents` es eliminada

#### Scenario: Acceso a template de otro workspace es rechazado
- **WHEN** el cliente intenta operar sobre un template que no pertenece a su workspace
- **THEN** el servidor responde `403 Forbidden`

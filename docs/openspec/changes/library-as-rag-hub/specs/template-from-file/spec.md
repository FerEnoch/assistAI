## ADDED Requirements

### Requirement: El usuario puede crear un template subiendo un archivo local
El sistema SHALL permitir al usuario crear un nuevo template a partir de un archivo local (PDF, DOCX, TXT). El archivo se indexa como documento del workspace y queda asociado al template creado.

#### Scenario: Upload exitoso crea template y asocia documento
- **WHEN** el usuario selecciona la opción "Subir archivo" en el modal de nuevo template
- **AND** selecciona un archivo válido (PDF, DOCX o TXT, máximo 20MB)
- **AND** completa el nombre del template y el tipo de documento
- **AND** confirma el formulario
- **THEN** el sistema crea el template con las secciones especificadas (puede ser vacío)
- **THEN** el sistema crea un Document en estado `queued` vinculado al workspace
- **THEN** el sistema encola el documento para ingest (embedding)
- **THEN** el sistema crea la asociación en `template_documents`
- **THEN** el template aparece en la biblioteca con el documento asociado visible

#### Scenario: Archivo supera el límite de tamaño
- **WHEN** el usuario intenta subir un archivo mayor a 20MB
- **THEN** el sistema SHALL rechazar el upload con error `413 Payload Too Large`
- **THEN** la UI muestra el mensaje: "El archivo supera el límite de 20MB."

#### Scenario: Tipo de archivo no soportado
- **WHEN** el usuario intenta subir un archivo con extensión no soportada (ej: .xlsx, .zip)
- **THEN** el sistema SHALL rechazar con error `415 Unsupported Media Type`
- **THEN** la UI muestra: "Solo se admiten archivos PDF, DOCX o TXT."

#### Scenario: Nombre del template es requerido
- **WHEN** el usuario intenta confirmar el formulario sin haber completado el nombre del template
- **THEN** el botón de confirmar SHALL estar deshabilitado
- **THEN** el sistema no realiza ninguna llamada al API

### Requirement: El endpoint POST /templates/from-upload recibe multipart/form-data
El API SHALL exponer `POST /templates/from-upload` que acepta `multipart/form-data` con los campos: `file` (binario), `name` (string), `docType` (string), `description` (string, opcional), `sections` (JSON string, opcional).

#### Scenario: Request válido retorna el template creado
- **WHEN** el cliente envía `POST /templates/from-upload` con campos válidos
- **THEN** el servidor responde `201 Created` con el objeto template serializado (id, name, docType, sections, createdAt)

#### Scenario: Request sin autenticación es rechazado
- **WHEN** el cliente envía la request sin cookie de sesión válida
- **THEN** el servidor responde `401 Unauthorized`

#### Scenario: El campo `file` es obligatorio
- **WHEN** el cliente envía la request sin el campo `file`
- **THEN** el servidor responde `400 Bad Request`

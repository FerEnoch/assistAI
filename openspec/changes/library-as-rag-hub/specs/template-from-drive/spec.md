## ADDED Requirements

### Requirement: El usuario puede crear un template a partir de un archivo de Google Drive
El sistema SHALL permitir al usuario seleccionar un archivo de Google Drive (usando el DrivePicker existente) como base para un nuevo template. El archivo se indexa como documento del workspace y queda asociado al template.

#### Scenario: Drive conectado — selección exitosa
- **WHEN** el usuario selecciona la opción "Importar desde Drive" en el modal de nuevo template
- **AND** Google Drive ya está conectado al workspace
- **THEN** el sistema muestra el DrivePicker con los archivos disponibles

#### Scenario: Drive no conectado — se muestra flujo de conexión
- **WHEN** el usuario selecciona la opción "Importar desde Drive"
- **AND** el workspace NO tiene una fuente de Drive conectada
- **THEN** el sistema muestra un estado inline en el modal con el mensaje: "Conectá tu Google Drive para usar esta opción."
- **THEN** el sistema muestra un botón "Conectar Google Drive" que inicia el flujo OAuth

#### Scenario: Template creado desde Drive
- **WHEN** el usuario selecciona un archivo en el DrivePicker
- **AND** completa nombre del template y tipo de documento
- **AND** confirma
- **THEN** el sistema crea el template
- **THEN** el sistema crea un Document vinculado al fileId de Drive seleccionado
- **THEN** el sistema encola el documento para ingest
- **THEN** el sistema crea la asociación en `template_documents`

#### Scenario: Solo se puede seleccionar un archivo al crear desde Drive
- **WHEN** el usuario está en el DrivePicker en contexto de "crear template"
- **THEN** el picker SHALL permitir seleccionar máximo un archivo (no carpetas, no múltiples)
- **THEN** el botón confirmar SHALL estar deshabilitado si no hay archivo seleccionado

### Requirement: El endpoint POST /templates/from-drive recibe el fileId de Drive
El API SHALL exponer `POST /templates/from-drive` con body JSON: `{ fileId: string, sourceId: string, name: string, docType: string, description?: string, sections?: Section[] }`.

#### Scenario: Request válido retorna template creado
- **WHEN** el cliente envía un request válido con `fileId` y `sourceId` pertenecientes al workspace del usuario autenticado
- **THEN** el servidor responde `201 Created` con el template serializado

#### Scenario: fileId no encontrado en Drive
- **WHEN** el `fileId` enviado no existe en la cuenta de Drive del usuario
- **THEN** el servidor responde `404 Not Found` con mensaje descriptivo

#### Scenario: sourceId no pertenece al workspace
- **WHEN** el `sourceId` enviado pertenece a un workspace distinto
- **THEN** el servidor responde `403 Forbidden`

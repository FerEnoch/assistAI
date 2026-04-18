## Why

El Dashboard actual es una pantalla intermedia vacía de valor: muestra el nombre del workspace, un botón para conectar Drive y un link al editor. Toda esa funcionalidad puede vivir de forma más natural en `/library`, que es donde el usuario realmente trabaja. Eliminar ese paso reduce la fricción post-login y convierte la biblioteca en el verdadero centro de operaciones del RAG.

## What Changes

- **BREAKING** Eliminar la ruta `/dashboard` y redirigir post-login directamente a `/library`
- Mover la conexión de Drive y el estado de indexación a la pantalla de Library
- Agregar capacidad de crear un template a partir de un archivo local (upload)
- Agregar capacidad de crear un template a partir de un archivo de Google Drive
- Las secciones del template se definen manualmente por el usuario (no hay auto-detección)
- Agregar la capacidad de asociar documentos del corpus a un template específico
- El corpus pasa de ser una vista global (stats del workspace) a mostrarse agrupado por template
- Un documento puede asociarse a múltiples templates

## Capabilities

### New Capabilities

- `library-navigation`: Library como landing post-login; eliminación del dashboard; header navega a `/library`
- `template-from-file`: Crear un template subiendo un archivo local (PDF, DOCX, TXT) — el archivo se indexa como documento y queda asociado al template
- `template-from-drive`: Crear un template seleccionando un archivo de Google Drive ya conectado — el archivo se indexa como documento y queda asociado al template
- `template-corpus`: Asociar y desasociar documentos del corpus a un template; visualizar qué documentos alimentan cada template; stats de corpus por template en lugar de global

### Modified Capabilities

- `library-ui`: La UI de library incorpora el flujo de conexión de Drive, el estado de indexación, las nuevas acciones de creación de template y el corpus por template (reemplaza el panel de stats global)

## Impact

- **Web**: `App.tsx` (rutas + redirect), `LoginPage.tsx` (navigate post-login), `DashboardPage.tsx` (eliminada), `LibraryPage.tsx` (nueva UI), `TemplateModal.tsx` (nuevas opciones de creación)
- **API**: No se requieren cambios de fondo nuevos — el pipeline de ingest ya existe; se necesita un endpoint para asociar documentos a templates (`POST /templates/:id/documents`, `DELETE /templates/:id/documents/:docId`, `GET /templates/:id/documents`)
- **Entities**: Agregar tabla de join `template_documents` (template_id, document_id) con PK compuesta
- **Hooks**: `useTemplates` se extiende con métodos para corpus; nuevo hook `useTemplateDocuments`
- **DashboardPage**: Se elimina del árbol de rutas y del sistema de archivos

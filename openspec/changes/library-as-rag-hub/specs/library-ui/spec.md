## MODIFIED Requirements

### Requirement: Library es la pantalla principal post-login
La página `/library` SHALL ser la pantalla de aterrizaje para todos los usuarios autenticados. Incorpora las funcionalidades que antes vivían en `/dashboard`: estado de conexión de Drive y estado de indexación. El panel lateral de stats globales es reemplazado por el corpus agrupado por template.

#### Scenario: Usuario autenticado aterriza en library
- **WHEN** el usuario completa el login
- **THEN** ve la pantalla de Library con la lista de templates (o empty state)
- **THEN** NO hay pantalla de Dashboard intermedia

#### Scenario: Empty state sin templates ni Drive
- **WHEN** el workspace no tiene templates ni Drive conectado
- **THEN** la UI muestra un estado vacío con dos CTAs: "Nuevo template" y "Conectar Google Drive"

### Requirement: La acción "Nuevo template" tiene tres opciones
La UI SHALL ofrecer tres formas de crear un template, accesibles desde un menú o selección al hacer click en "+ Nuevo Template":

1. **Definir manualmente** — modal con nombre, tipo, secciones (comportamiento actual)
2. **Subir archivo local** — abre selector de archivo local; nombre y tipo requeridos post-selección
3. **Importar desde Drive** — abre DrivePicker en modo single-select; nombre y tipo requeridos post-selección

#### Scenario: Selección de modo de creación
- **WHEN** el usuario hace click en "+ Nuevo Template"
- **THEN** la UI muestra las tres opciones de creación
- **THEN** al seleccionar cualquier opción, se abre el flujo correspondiente

#### Scenario: Drive no conectado en opción "Importar desde Drive"
- **WHEN** el usuario selecciona "Importar desde Drive"
- **AND** el workspace no tiene Drive conectado
- **THEN** la UI muestra un estado inline: "Conectá tu Google Drive para usar esta opción" con botón de conexión

### Requirement: El estado de Drive connection es visible en Library
El sistema SHALL mostrar el estado de la fuente Drive (conectada / no conectada) en Library de forma no-intrusiva, accesible cuando el usuario lo necesita.

#### Scenario: Drive conectado — badge visible
- **WHEN** el workspace tiene una fuente Drive con status `connected` o `syncing`
- **THEN** la UI muestra un indicador de estado discreto (badge o ícono) junto al botón de nuevo template

#### Scenario: Drive no conectado — banner en acción
- **WHEN** el usuario intenta usar una funcionalidad que requiere Drive y no está conectado
- **THEN** la UI muestra el CTA de conexión en el contexto de la acción (no como un banner global permanente)

#### Scenario: Retorno desde OAuth de Drive con ?source=connected
- **WHEN** el usuario retorna a `/library?source=connected` luego del redirect OAuth
- **THEN** el sistema refetch las fuentes
- **THEN** la URL se limpia (replaceState) para evitar re-trigger en navegación hacia atrás

### Requirement: IndexingStatus está disponible en Library
El componente de estado de indexación SHALL estar accesible en Library (puede ser colapsable o en sección secundaria), no en Dashboard.

#### Scenario: Estado de indexación visible
- **WHEN** hay documentos en estado `queued` o `processing` en el workspace
- **THEN** el usuario puede ver el estado de progreso desde Library

## REMOVED Requirements

### Requirement: Dashboard page existe como landing post-login
**Reason**: La pantalla de Dashboard no aportaba valor diferencial. Todas sus funcionalidades (Drive connection, IndexingStatus, link al editor) se integran en Library, que es donde el usuario realmente trabaja.
**Migration**: La ruta `/dashboard` redirige a `/library`. El componente `DashboardPage.tsx` es eliminado.

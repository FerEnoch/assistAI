# Spec: template-entity

## Purpose

Definir el contrato de datos y comportamiento de las entidades `Template` y `TemplateSection`, incluyendo las reglas de negocio de tenant isolation, ownership validation, y el ciclo de vida de los chunks asociados.

---

## Requirements

### Requirement: Template entity

La entidad `Template` MUST existir en `packages/entities/src/template.entity.ts` y representar una estructura jurídica reutilizable definida por el usuario.

| Campo | Tipo DB | Nullable | Descripción |
|-------|---------|----------|-------------|
| `id` | `uuid` | No | PK generada automáticamente |
| `workspaceId` | `uuid FK → workspaces.id` | No | Tenant del template |
| `name` | `varchar(255)` | No | Nombre descriptivo |
| `description` | `text` | Sí | Descripción opcional |
| `docType` | `varchar(50)` | Sí | `LegalDocType` del template |
| `isActive` | `boolean DEFAULT true` | No | Templates inactivos no aparecen en el selector del editor |
| `sections` | `TemplateSection[]` (relación) | — | Secciones del template (cargadas con eager) |
| `createdAt` | `timestamptz` | No | Autogenerado |
| `updatedAt` | `timestamptz` | No | Actualizado en cada UPDATE |

#### Scenario: Template creado con campos mínimos

- GIVEN `CreateTemplateDto { name: 'Contrato de Servicios', sections: [] }`
- WHEN `TemplateService.create()` ejecuta
- THEN MUST persistirse un `Template` con `isActive: true`, `docType: null`, `description: null`
- AND `sections` MUST ser array vacío

---

### Requirement: TemplateSection entity

| Campo | Tipo DB | Nullable | Descripción |
|-------|---------|----------|-------------|
| `id` | `uuid` | No | PK generada automáticamente |
| `templateId` | `uuid FK → templates.id CASCADE` | No | FK al template padre |
| `name` | `varchar(255)` | No | Nombre de la sección (ej. "Cláusula de Confidencialidad") |
| `order` | `int DEFAULT 0` | No | Orden de aparición en el template |
| `sampleContent` | `text` | Sí | Texto de ejemplo para indexar como embedding. NULL → sección no se indexa |
| `clauseType` | `varchar(50)` | Sí | `ClauseType` de la sección |

#### Scenario: Sección sin sampleContent no genera chunk

- GIVEN una `TemplateSection` con `sampleContent: null`
- WHEN `TemplateService.indexTemplateSections()` procesa esa sección
- THEN NO MUST generarse ningún `DocumentChunk` para esa sección
- AND la sección MUST persistirse en `template_sections` sin error

---

### Requirement: Tenant isolation

`TemplateService` MUST verificar ownership del workspace en toda operación de escritura y eliminación.

#### Scenario: Workspace no puede acceder a templates de otro workspace

- GIVEN un template creado por workspaceA
- WHEN workspaceB llama `update(templateId, dto, workspaceB.id)`
- THEN la operación MUST lanzar `NotFoundException` (`404`)
- AND el template de workspaceA MUST permanecer sin cambios

#### Scenario: findAll respeta tenant

- GIVEN workspaces A y B con templates propios
- WHEN `findAll(workspaceA.id)` es llamado
- THEN MUST retornar solo los templates de workspaceA
- AND templates de workspaceB MUST estar ausentes del resultado

---

### Requirement: Ciclo de vida de chunks del template

Cuando un template es guardado, sus secciones con `sampleContent` MUST ser indexadas como `DocumentChunk` con metadata especial.

#### Scenario: Sección indexada con metadata correcta

- GIVEN una sección con `sampleContent: 'Toda información compartida...'` y `clauseType: 'confidencialidad'`
- AND el template padre tiene `docType: 'CONTRATO'`
- WHEN `indexTemplateSections()` ejecuta
- THEN el chunk MUST ser persistido con:
  ```json
  {
    "metadata": {
      "docType": "CONTRATO",
      "section": "clausulas",
      "clauseType": "confidencialidad",
      "isTemplate": true,
      "sourceTemplateId": "<template.id>",
      "tags": []
    }
  }
  ```

#### Scenario: Update re-indexa secciones

- GIVEN un template existente con 2 secciones indexadas
- WHEN `update()` es llamado con nuevas secciones
- THEN los chunks anteriores del template MUST ser eliminados (`DELETE WHERE metadata->>'sourceTemplateId' = templateId`)
- AND las nuevas secciones MUST ser indexadas

#### Scenario: Delete en cascada elimina chunks

- GIVEN un template con secciones indexadas
- WHEN `remove(templateId, workspaceId)` es llamado
- THEN `removeTemplateChunks(templateId)` MUST ejecutar primero
- THEN el DELETE del template MUST ejecutar
- AND no MUST existir chunks con `metadata->>'sourceTemplateId' = templateId`

---

### Requirement: Validación de DTOs

`CreateTemplateDto` MUST validar:

- `name`: requerido, string, 1-255 chars
- `description`: opcional, string
- `docType`: opcional, string (debe ser un valor de `LegalDocType` o null)
- `sections`: array opcional (puede ser vacío), cada elemento es `CreateTemplateSectionDto`
  - `name`: requerido, string
  - `order`: requerido, número entero ≥ 0
  - `sampleContent`: opcional, string, máximo 5000 chars
  - `clauseType`: opcional, string

#### Scenario: Request con name vacío

- GIVEN `POST /templates` con body `{ name: '', sections: [] }`
- WHEN el controller recibe el request
- THEN MUST retornar `400 Bad Request` con mensaje de validación
- AND ningún template MUST ser creado

#### Scenario: Máximo de secciones por template

- GIVEN `CreateTemplateDto` con 21 secciones
- WHEN el service procesa el request
- THEN MUST lanzar un error de validación (máximo 20 secciones permitidas por template)

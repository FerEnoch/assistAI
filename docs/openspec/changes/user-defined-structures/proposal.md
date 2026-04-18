# Proposal: user-defined-structures

## Intent

El corpus del usuario hoy es pasivo: se indexa, se recupera, pero el usuario no puede **definir** qué estructura quiere que el sistema conozca. Un abogado que siempre usa la misma cláusula de confidencialidad, el mismo encabezado de contrato, o la misma estructura de demanda no tiene forma de "enseñarle" eso al sistema explícitamente.

Este cambio introduce **Templates**: estructuras jurídicas reutilizables que el usuario define, guarda en una biblioteca, y selecciona desde el editor. Cuando el usuario elige un template, el sistema lo usa como referencia preferida para el retrieval — elevando su prioridad sobre chunks genéricos del corpus.

El resultado: el sistema aprende el estilo y las estructuras propias de cada estudio jurídico, en lugar de mezclar estilos de distintos documentos.

## Scope

### In Scope
- Entidad `Template` con `TemplateSection[]` (relación 1:N)
- CRUD REST API: `GET /templates`, `POST /templates`, `PUT /templates/:id`, `DELETE /templates/:id`
- Página **Mi Biblioteca** (`/library`): lista templates + stats de documentos indexados
- **Selector de template en el editor**: dropdown en toolbar, setea el template activo para la sesión
- Indexación de templates: al guardar un template, sus secciones se indexan como chunks con `metadata.isTemplate: true` y `metadata.sourceTemplateId`
- Retrieval preferencial: cuando hay un template activo en el editor, el retrieval prioriza chunks con `sourceTemplateId === templateId`

### Out of Scope
- Compartir templates entre workspaces
- Templates con variables (ej. `{{nombre_parte}}`) — eso es v2
- Importación de templates desde archivos .docx o .pdf
- Versionado de templates
- Templates públicos / marketplace

## Capabilities

### New Capabilities
- `template-library`: CRUD de templates jurídicos con secciones nombradas y sampleContent
- `library-page`: Pantalla `/library` con listado de templates, stats del corpus (docs indexados, chunks, docTypes breakdown)
- `editor-template-selector`: Dropdown en toolbar del editor para activar un template como contexto preferido
- `template-aware-retrieval`: Cuando hay un template activo, el retrieval boost-ea chunks de ese template

### Modified Capabilities
- `indexing-pipeline`: Al guardar un template, sus secciones se indexan como chunks especiales (`isTemplate: true`)
- `completion-pipeline`: Acepta `templateId` opcional en el request; modifica el retrieval para priorizar chunks del template activo

## Approach

**Phase 1 — Entidad + API**

1. Crear entidad `Template` (TypeORM) con relación `TemplateSection[]`
2. Migration: tablas `templates` y `template_sections`
3. `TemplateModule` con `TemplateService` + `TemplateController` (CRUD completo)
4. Al crear/actualizar template: indexar secciones con metadata `{ isTemplate: true, sourceTemplateId: id }`

**Phase 2 — Library UI**

1. Página `LibraryPage` en `/library`
2. Lista de templates con nombre, docType badge, secciones count, acciones (editar/eliminar)
3. Stats card: total docs indexados, total chunks, breakdown por docType
4. Formulario modal: crear/editar template con secciones dinámicas
5. Ruta agregada en `App.tsx`

**Phase 3 — Editor Template Selector**

1. `TemplateSelector` dropdown en toolbar de `AssistEditor`
2. Hook `useActiveTemplate`: state del template activo (persist en sessionStorage)
3. Pasar `templateId` en el body del completion request
4. En `CompletionService`: si `templateId` presente → priorizar chunks con ese `sourceTemplateId` en el resultado del retrieval

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/entities/src/template.entity.ts` | New | Entidad `Template` |
| `packages/entities/src/template-section.entity.ts` | New | Entidad `TemplateSection` |
| `packages/entities/src/index.ts` | Modified | Exportar nuevas entidades |
| `packages/db/src/migrations/` | New | Migration: tablas `templates` + `template_sections` |
| `apps/api/src/templates/template.module.ts` | New | NestJS module |
| `apps/api/src/templates/template.service.ts` | New | CRUD + indexing de secciones |
| `apps/api/src/templates/template.controller.ts` | New | REST endpoints |
| `apps/api/src/templates/dto/` | New | DTOs de creación/actualización |
| `apps/api/src/app.module.ts` | Modified | Registrar `TemplateModule` |
| `apps/api/src/completion/completion.service.ts` | Modified | Aceptar `templateId`, priorizar chunks del template |
| `apps/api/src/completion/completion.controller.ts` | Modified | Aceptar `templateId` en el request body |
| `apps/web/src/pages/LibraryPage.tsx` | New | Pantalla Mi Biblioteca |
| `apps/web/src/library/TemplateList.tsx` | New | Lista de templates |
| `apps/web/src/library/TemplateFormModal.tsx` | New | Formulario crear/editar |
| `apps/web/src/library/LibraryStats.tsx` | New | Stats del corpus |
| `apps/web/src/editor/TemplateSelector.tsx` | New | Dropdown selector |
| `apps/web/src/editor/use-active-template.ts` | New | Hook state del template activo |
| `apps/web/src/editor/AssistEditor.tsx` | Modified | Integrar `TemplateSelector` en toolbar |
| `apps/web/src/App.tsx` | Modified | Agregar ruta `/library` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Indexar secciones al guardar agrega latencia al save | Low | Indexing asíncrono via worker (mismo mecanismo que documentos) |
| Template activo genera retrieval muy restrictivo (0 hits) | Medium | Fallback: si priorización retorna 0 hits, usar retrieval estándar |
| Usuario crea template con sampleContent pobre → embeddings malos | Medium | Documentar mínimo recomendado de 100 chars por sección |
| Múltiples templates activos simultáneos | Low | Solo un template activo por sesión de editor (simpleza) |

## Rollback Plan

- `TemplateModule` es independiente — se puede desregistrar de `AppModule` sin afectar el sistema
- `templateId` en CompletionService es opcional — si no se pasa, comportamiento idéntico al actual
- Tablas de templates pueden quedar vacías sin impacto

## Dependencies

- Change `chunk-metadata-and-smart-retrieval` DEBE estar implementado primero (requiere `isTemplate` y `sourceTemplateId` en `ChunkMetadata`)
- Worker de indexing operativo (para indexar secciones de templates)
- pgvector + RetrievalService operativos

## Success Criteria

- [ ] CRUD de templates funciona: crear, listar, editar, eliminar
- [ ] Secciones de template se indexan al guardar (chunks con `isTemplate: true`)
- [ ] `LibraryPage` muestra templates + stats del corpus
- [ ] Selector en editor permite activar un template
- [ ] Con template activo, completions traen evidencia del template como primer hit
- [ ] Sin template activo, comportamiento idéntico al actual
- [ ] 25+ tests pasando (service unit tests + controller integration)

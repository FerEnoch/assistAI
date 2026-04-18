# Tasks: user-defined-structures

> **Prerequisito**: Change `chunk-metadata-and-smart-retrieval` DEBE estar implementado antes de arrancar estas tasks (requiere `ChunkMetadata.isTemplate` y `sourceTemplateId`).

## Phase 1 — Entidades + Migration

### 1. Entidades TypeORM
- [ ] **T-1.1** Crear `packages/entities/src/template.entity.ts` con `@Entity('templates')`: campos `id`, `workspaceId`, `name`, `description`, `docType`, `isActive`, `sections`, `createdAt`, `updatedAt`
- [ ] **T-1.2** Crear `packages/entities/src/template-section.entity.ts` con `@Entity('template_sections')`: campos `id`, `templateId`, `template`, `name`, `order`, `sampleContent`, `clauseType`
- [ ] **T-1.3** Exportar `Template` y `TemplateSection` desde `packages/entities/src/index.ts`

### 2. Migration
- [ ] **T-2.1** Crear migration `<timestamp>-create-templates.ts`
- [ ] **T-2.2** `up()`: `CREATE TABLE templates (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name varchar(255) NOT NULL, description text, doc_type varchar(50), is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`
- [ ] **T-2.3** `up()`: `CREATE TABLE template_sections (id uuid PRIMARY KEY, template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE, name varchar(255) NOT NULL, "order" int NOT NULL DEFAULT 0, sample_content text, clause_type varchar(50))`
- [ ] **T-2.4** `down()`: `DROP TABLE template_sections; DROP TABLE templates`
- [ ] **T-2.5** Verificar migration corre sin errores en ambiente local

## Phase 2 — API (Backend)

### 3. DTOs
- [ ] **T-3.1** Crear `apps/api/src/templates/dto/create-template.dto.ts`: `CreateTemplateDto` con validaciones class-validator (`@IsString`, `@MinLength`, `@IsOptional`, `@ValidateNested`, `@Type`)
- [ ] **T-3.2** Crear `CreateTemplateSectionDto` en el mismo archivo: `name`, `order`, `sampleContent?`, `clauseType?`
- [ ] **T-3.3** Crear `apps/api/src/templates/dto/update-template.dto.ts`: `PartialType(CreateTemplateDto)`

### 4. Unit Tests del Service (TDD)
- [ ] **T-4.1** Crear `apps/api/src/templates/__tests__/template.service.test.ts`
- [ ] **T-4.2** Test: `create()` inserta el template y sus secciones; indexa cada sección con `isTemplate: true`
- [ ] **T-4.3** Test: `findAll(workspaceId)` solo retorna templates del workspace correcto (tenant isolation)
- [ ] **T-4.4** Test: `update()` actualiza el template; elimina chunks anteriores e indexa secciones nuevas
- [ ] **T-4.5** Test: `remove(id, workspaceId)` verifica que el template pertenece al workspace antes de eliminar
- [ ] **T-4.6** Test: `remove()` elimina el template → cascada elimina `template_sections` y chunks con `sourceTemplateId`

### 5. TemplateService
- [ ] **T-5.1** Crear `apps/api/src/templates/template.service.ts` con `@Injectable() TemplateService`
- [ ] **T-5.2** Inyectar `@InjectRepository(Template)` y `@InjectRepository(TemplateSection)` y `IndexingService` (o equivalente para indexar chunks)
- [ ] **T-5.3** Implementar `findAll(workspaceId: string): Promise<Template[]>`
- [ ] **T-5.4** Implementar `create(dto: CreateTemplateDto, workspaceId: string): Promise<Template>` — INSERT + indexar secciones
- [ ] **T-5.5** Implementar `private indexTemplateSections(template: Template): Promise<void>` — para cada sección con `sampleContent`, indexar como chunk con metadata `{ isTemplate: true, sourceTemplateId: template.id, docType: template.docType, clauseType: section.clauseType }`
- [ ] **T-5.6** Implementar `update(id: string, dto: UpdateTemplateDto, workspaceId: string): Promise<Template>` — verificar ownership, UPDATE, re-indexar secciones
- [ ] **T-5.7** Implementar `private removeTemplateChunks(templateId: string): Promise<void>` — DELETE FROM document_chunks WHERE metadata->>'sourceTemplateId' = templateId
- [ ] **T-5.8** Implementar `remove(id: string, workspaceId: string): Promise<void>` — verificar ownership, `removeTemplateChunks`, DELETE template

### 6. TemplateController
- [ ] **T-6.1** Crear `apps/api/src/templates/template.controller.ts` con `@Controller('templates')` + `@UseGuards(JwtAuthGuard)`
- [ ] **T-6.2** Implementar `@Get() findAll()` — retorna `this.templateService.findAll(req.user.workspaceId)`
- [ ] **T-6.3** Implementar `@Post() create(@Body() dto, @Req() req)` — valida DTO, llama `create(dto, workspaceId)`
- [ ] **T-6.4** Implementar `@Put(':id') update(@Param('id') id, @Body() dto, @Req() req)`
- [ ] **T-6.5** Implementar `@Delete(':id') remove(@Param('id') id, @Req() req)` — retorna 204
- [ ] **T-6.6** Crear `apps/api/src/templates/template.module.ts`: registrar `TypeOrmModule.forFeature`, `TemplateService`, `TemplateController`

### 7. Library Stats
- [ ] **T-7.1** Crear `apps/api/src/library/library.module.ts` + `library.controller.ts` + `library.service.ts`
- [ ] **T-7.2** Implementar `GET /library/stats` que retorna `LibraryStatsDto`: `totalDocuments`, `totalChunks`, `totalTemplates`, `docTypeBreakdown`
- [ ] **T-7.3** Registrar `TemplateModule` y `LibraryModule` en `apps/api/src/app.module.ts`

### 8. CompletionService — templateId + re-rank
- [ ] **T-8.1** Agregar `templateId?: string` a `CompletionRequestDto` en `completion.controller.ts` (`@IsOptional, @IsUUID`)
- [ ] **T-8.2** Pasar `templateId` de DTO a `CompletionService.runPipeline(prefix, workspaceId, templateId?)`
- [ ] **T-8.3** Cuando `templateId` presente: llamar `findSimilarChunks` con `topK + 2` y `threshold - 0.07`
- [ ] **T-8.4** Implementar `private reRankWithTemplate(hits, templateId, topK): RetrievalHit[]` — template hits al top
- [ ] **T-8.5** Test: con `templateId`, chunks del template aparecen primeros en `evidence[]`
- [ ] **T-8.6** Test: sin `templateId`, comportamiento idéntico al actual

## Phase 3 — Frontend

### 9. Library API client
- [ ] **T-9.1** Crear `apps/web/src/library/api.ts`: `fetchTemplates()`, `createTemplate(dto)`, `updateTemplate(id, dto)`, `deleteTemplate(id)`, `fetchLibraryStats()`

### 10. Library UI components
- [ ] **T-10.1** Crear `apps/web/src/library/LibraryStats.tsx`: muestra `totalDocuments`, `totalChunks`, `docTypeBreakdown` en cards
- [ ] **T-10.2** Crear `apps/web/src/library/TemplateList.tsx`: lista de templates, cada item con nombre, badge de docType, cantidad de secciones, botones editar/eliminar
- [ ] **T-10.3** Crear `apps/web/src/library/TemplateFormModal.tsx`: formulario con nombre, descripción, docType select, lista dinámica de secciones (agregar/quitar/ordenar)
- [ ] **T-10.4** Crear `apps/web/src/pages/LibraryPage.tsx`: orquesta `LibraryStats` + `TemplateList` + `TemplateFormModal`; maneja CRUD state

### 11. Editor — TemplateSelector
- [ ] **T-11.1** Crear `apps/web/src/editor/use-active-template.ts`: hook con `activeTemplate`, `setActiveTemplate`, `clearTemplate` — persiste en `sessionStorage`
- [ ] **T-11.2** Crear `apps/web/src/editor/TemplateSelector.tsx`: dropdown que lista templates del workspace, muestra el activo, permite limpiar selección
- [ ] **T-11.3** Integrar `TemplateSelector` en `apps/web/src/editor/AssistEditor.tsx` toolbar
- [ ] **T-11.4** Pasar `templateId: activeTemplate?.id` en el body del completion request
- [ ] **T-11.5** Agregar ruta `/library` → `LibraryPage` en `apps/web/src/App.tsx`

---

## Implementation Order

```
T-1.1 → T-1.2 → T-1.3 (entidades)
T-2.1 → T-2.2 → T-2.3 → T-2.4 → T-2.5 (migration)
T-3.1 → T-3.2 → T-3.3 (DTOs)
T-4.x (tests TDD)
T-5.1 → ... → T-5.8 (TemplateService)
T-6.1 → ... → T-6.6 (TemplateController + Module)
T-7.1 → T-7.2 → T-7.3 (LibraryStats)
T-8.1 → ... → T-8.6 (CompletionService)
T-9.1 (API client)
T-10.1 → T-10.2 → T-10.3 → T-10.4 (Library UI)
T-11.1 → T-11.2 → T-11.3 → T-11.4 → T-11.5 (Editor)
```

**Total: 49 tasks** en 11 fases.

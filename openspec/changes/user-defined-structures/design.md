# Design: user-defined-structures

## Technical Approach

Three-phase feature que introduce la entidad `Template` como una nueva abstracción de primer nivel en el sistema. Los templates son documentos-referencia definidos por el usuario, indexados como chunks especiales, y activados como contexto preferido en el editor.

La arquitectura sigue el mismo patrón del pipeline existente: templates → indexing → chunks con metadata → retrieval. No hay un sistema de retrieval separado para templates; se integran al flujo existente via la columna `metadata.isTemplate` del Change 1.

## Arquitectura de decisiones

| Decisión | Opción elegida | Alternativas | Justificación |
|----------|---------------|-------------|---------------|
| Storage de templates | Tablas propias `templates` + `template_sections` | JSONB en `documents`, blob storage | Consultas relacionales eficientes; relación clara con workspace; permite FK y cascade |
| Indexación de secciones | Indexing síncrono en `TemplateService.save()` | Queue asíncrono como documentos | Templates son pequeños (5-10 secciones × 300-500 chars); latencia de save < 2s aceptable |
| Priorización de template | Re-rank: mover chunks del template al top del resultado | Score boost en SQL, query separada | Re-rank en memoria post-retrieval: simple, testeable, sin cambio SQL |
| Activación en editor | `useActiveTemplate` hook con sessionStorage | Context global, URL param | Scope correcto: activo solo mientras el editor está abierto; no persiste entre pestañas |
| Formulario de template | Modal (no page separada) | Page dedicada `/library/template/new` | UX: crear template sin salir de la biblioteca; menos navegación |
| Stats del corpus | Endpoint `GET /library/stats` | Queries en cliente | Query única con agregaciones SQL; evita N+1 |

## Data Flow

### Template Save + Indexing

```
User fills TemplateFormModal
       │
       ▼
POST /templates (CreateTemplateDto)
       │
       ▼
TemplateService.create(dto, workspaceId)
       │
       ├─► INSERT templates (id, workspaceId, name, docType, isActive, ...)
       │
       └─► POR CADA TemplateSection:
             INSERT template_sections
             │
             ▼
           IndexingService.indexChunk(section.sampleContent, {
             workspaceId,
             documentId: template.id,  // template actúa como "documento"
             metadata: {
               docType: template.docType,
               section: templateSection.clauseType ?? null,
               clauseType: templateSection.clauseType,
               isTemplate: true,
               sourceTemplateId: template.id,
             }
           })
```

### Editor con Template Activo

```
User selects template from TemplateSelector
       │
       ▼
useActiveTemplate.setActive(template)
       │
       ▼
User types → completion request
       │
       ▼
POST /completion { prefix, workspaceId, templateId: activeTemplate.id }
       │
       ▼
CompletionService.runPipeline()
       │
       ▼
findSimilarChunks(workspaceId, embedding, { topK: 4+2, threshold: 0.65 })
   ← threshold ligeramente más bajo para capturar chunks del template aunque sean menos similares
       │
       ▼
Re-rank: mover chunks donde metadata.sourceTemplateId === templateId al TOP
       │
       ▼
evidence = top-4 re-rankeados
       │
       ▼
[structural gate] → si evidence[0] es del template y similarity >= 0.85 → structural path
                 → sino → LLM path con evidencia priorizada del template
```

## Schema de Entidades

```typescript
// packages/entities/src/template.entity.ts
@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'workspace_id' }) workspaceId!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'doc_type' })
  docType?: string | null;  // LegalDocType
  @Column({ type: 'boolean', default: true, name: 'is_active' }) isActive!: boolean;
  @OneToMany(() => TemplateSection, (s) => s.template, { cascade: true, eager: true })
  sections!: TemplateSection[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

// packages/entities/src/template-section.entity.ts
@Entity('template_sections')
export class TemplateSection {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'template_id' }) templateId!: string;
  @ManyToOne(() => Template, (t) => t.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' }) template!: Template;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'int', default: 0 }) order!: number;
  @Column({ type: 'text', nullable: true, name: 'sample_content' })
  sampleContent?: string | null;  // texto de ejemplo para indexar
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'clause_type' })
  clauseType?: string | null;  // ClauseType
}
```

## API Endpoints

| Método | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| `GET` | `/templates` | JWT | — | `Template[]` |
| `POST` | `/templates` | JWT | `CreateTemplateDto` | `Template` |
| `PUT` | `/templates/:id` | JWT | `UpdateTemplateDto` | `Template` |
| `DELETE` | `/templates/:id` | JWT | — | `204 No Content` |
| `GET` | `/library/stats` | JWT | — | `LibraryStatsDto` |

```typescript
// CreateTemplateDto
class CreateTemplateDto {
  name: string;                        // @IsString, @MinLength(1), @MaxLength(255)
  description?: string;               // @IsOptional
  docType?: string;                   // @IsOptional
  sections: CreateTemplateSectionDto[];
}

class CreateTemplateSectionDto {
  name: string;
  order: number;
  sampleContent?: string;
  clauseType?: string;
}

// LibraryStatsDto
class LibraryStatsDto {
  totalDocuments: number;
  totalChunks: number;
  totalTemplates: number;
  docTypeBreakdown: Record<string, number>;  // { CONTRATO: 42, DEMANDA: 15, ... }
}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/entities/src/template.entity.ts` | Create | Entidad Template |
| `packages/entities/src/template-section.entity.ts` | Create | Entidad TemplateSection |
| `packages/entities/src/index.ts` | Modify | Exportar nuevas entidades |
| `packages/db/src/migrations/<ts>-create-templates.ts` | Create | CREATE TABLE templates + template_sections |
| `apps/api/src/templates/template.module.ts` | Create | NestJS module |
| `apps/api/src/templates/template.service.ts` | Create | CRUD + indexing síncrono de secciones |
| `apps/api/src/templates/template.controller.ts` | Create | REST endpoints |
| `apps/api/src/templates/dto/create-template.dto.ts` | Create | CreateTemplateDto + CreateTemplateSectionDto |
| `apps/api/src/templates/dto/update-template.dto.ts` | Create | PartialType(CreateTemplateDto) |
| `apps/api/src/library/library.controller.ts` | Create | `GET /library/stats` |
| `apps/api/src/library/library.module.ts` | Create | NestJS module para stats |
| `apps/api/src/app.module.ts` | Modify | Registrar TemplateModule + LibraryModule |
| `apps/api/src/completion/completion.service.ts` | Modify | Aceptar templateId, re-rank, threshold ajustado |
| `apps/api/src/completion/completion.controller.ts` | Modify | Aceptar templateId en CompletionRequestDto |
| `apps/web/src/pages/LibraryPage.tsx` | Create | Página Mi Biblioteca |
| `apps/web/src/library/TemplateList.tsx` | Create | Lista de templates con acciones |
| `apps/web/src/library/TemplateFormModal.tsx` | Create | Formulario crear/editar |
| `apps/web/src/library/LibraryStats.tsx` | Create | Stats del corpus |
| `apps/web/src/library/api.ts` | Create | Funciones fetch para templates y stats |
| `apps/web/src/editor/TemplateSelector.tsx` | Create | Dropdown selector de template activo |
| `apps/web/src/editor/use-active-template.ts` | Create | Hook con sessionStorage |
| `apps/web/src/editor/AssistEditor.tsx` | Modify | Integrar TemplateSelector en toolbar |
| `apps/web/src/App.tsx` | Modify | Agregar ruta `/library → LibraryPage` |

## Re-rank Logic

```typescript
// En CompletionService.runPipeline(), cuando templateId está presente:

const rawHits = await this.retrieval.findSimilarChunks(workspaceId, embedding, {
  topK: COMPLETION_CONFIG.topK + 2,  // pedir más para tener margen para re-rank
  threshold: COMPLETION_CONFIG.similarityThreshold - 0.07,  // ligeramente más permisivo
});

const evidence = templateId
  ? this.reRankWithTemplate(rawHits, templateId, COMPLETION_CONFIG.topK)
  : rawHits.slice(0, COMPLETION_CONFIG.topK);

// ---

private reRankWithTemplate(hits: RetrievalHit[], templateId: string, topK: number): RetrievalHit[] {
  const templateHits = hits.filter(h => h.metadata?.sourceTemplateId === templateId);
  const otherHits = hits.filter(h => h.metadata?.sourceTemplateId !== templateId);
  return [...templateHits, ...otherHits].slice(0, topK);
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `TemplateService.create` | Mock repo, verificar que indexa secciones |
| Unit | `TemplateService` CRUD | Mock repo, verificar tenant isolation |
| Unit | `reRankWithTemplate` | Puro (no deps), verificar orden con y sin template hits |
| Integration | `POST /templates` | NestJS testing module, mock DB |
| Integration | `GET /library/stats` | Mock queries, verificar aggregation |
| Unit | `useActiveTemplate` | Testing con vitest + jsdom |

## Migration / Rollout

- **Deployment order**: Migration → API deploy → Web deploy
- **Templates vacíos**: Workspace sin templates funciona igual que antes (sin priorización)
- **Rollback**: Desregistrar `TemplateModule` de `AppModule`; opcional DROP TABLES

## Open Questions

- [ ] ¿Se debe re-indexar secciones al editar un template o crear chunks nuevos? → Propuesta: DELETE chunks del templateId + re-insert al update
- [ ] ¿Límite de secciones por template? → Propuesta: máximo 20 secciones por template
- [ ] ¿`LibraryStats` debe incluir templates en el conteo de chunks? → Propuesta: NO, templates son separados del corpus

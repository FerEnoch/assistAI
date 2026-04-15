# Spec: editor-template-selector

## Purpose

Definir el comportamiento del selector de templates en el toolbar del editor (`TemplateSelector`), el hook de estado del template activo (`useActiveTemplate`), y cómo el template activo modifica el pipeline de completion.

---

## Requirements

### Requirement: TemplateSelector — dropdown en toolbar del editor

`TemplateSelector` MUST estar integrado en el toolbar de `AssistEditor`, visible únicamente cuando el usuario tiene al menos un template creado.

#### Scenario: Sin templates — componente no visible

- GIVEN un workspace sin templates creados
- WHEN el editor carga
- THEN `TemplateSelector` MUST NO renderizarse (o renderizarse oculto sin ocupar espacio)

#### Scenario: Con templates — dropdown visible

- GIVEN un workspace con al menos un template activo
- WHEN el editor carga
- THEN MUST mostrarse un dropdown con label "Plantilla activa: ninguna" (estado inicial)
- AND al abrirlo MUST listar todos los templates activos del workspace con su nombre y badge de docType

#### Scenario: Seleccionar un template

- GIVEN el dropdown abierto con templates listados
- WHEN el usuario selecciona un template
- THEN el dropdown MUST mostrar "Plantilla activa: [nombre del template]"
- AND `useActiveTemplate.activeTemplate` MUST actualizarse con el template seleccionado
- AND las próximas completions MUST incluir `templateId` en el request

#### Scenario: Limpiar template activo

- GIVEN un template activo seleccionado
- WHEN el usuario selecciona "Sin plantilla" (primera opción del dropdown)
- THEN `useActiveTemplate.activeTemplate` MUST ser `null`
- AND las próximas completions MUST NO incluir `templateId` en el request

---

### Requirement: useActiveTemplate hook

```typescript
interface ActiveTemplateState {
  activeTemplate: Template | null;
  setActiveTemplate: (template: Template | null) => void;
  clearTemplate: () => void;
}
```

#### Scenario: Estado inicial

- GIVEN el editor se monta por primera vez
- WHEN `useActiveTemplate()` es invocado
- THEN `activeTemplate` MUST ser `null`

#### Scenario: Persistencia en sessionStorage

- GIVEN un template activo `{ id: 'abc', name: 'Mi Plantilla' }`
- WHEN el usuario recarga la página (F5)
- THEN `activeTemplate` MUST ser restaurado desde sessionStorage
- AND las completions MUST continuar usando `templateId: 'abc'`

#### Scenario: sessionStorage se limpia al cerrar la pestaña

- GIVEN un template activo en sessionStorage
- WHEN el usuario cierra la pestaña del navegador
- THEN sessionStorage MUST limpiarse automáticamente (comportamiento nativo de sessionStorage)
- AND al abrir una nueva pestaña del editor, `activeTemplate` MUST ser `null`

---

### Requirement: Modificación del completion request

Cuando hay un template activo, el body del request a `POST /completion` MUST incluir `templateId`.

#### Scenario: Request con template activo

- GIVEN `activeTemplate = { id: 'template-xyz', name: 'Contrato' }`
- WHEN el usuario dispara una completion
- THEN el request body MUST incluir `templateId: 'template-xyz'`

#### Scenario: Request sin template activo

- GIVEN `activeTemplate = null`
- WHEN el usuario dispara una completion
- THEN el request body MUST NO incluir el campo `templateId` (o incluirlo como `undefined`/`null`)
- AND el pipeline MUST comportarse exactamente como antes del change

---

### Requirement: Impacto en el pipeline de completion (API)

Cuando `templateId` está presente en el request, `CompletionService.runPipeline()` MUST modificar el retrieval para priorizar chunks del template.

#### Scenario: Re-rank prioriza chunks del template

- GIVEN un workspace con 100 chunks de documentos y 5 chunks del template activo
- AND el prefijo del usuario es contextualmente relevante para varios chunks
- WHEN `runPipeline(prefix, workspaceId, templateId)` ejecuta
- THEN `findSimilarChunks` MUST llamarse con `topK + 2` (para tener margen para re-rank)
- AND los chunks donde `metadata.sourceTemplateId === templateId` MUST aparecer PRIMERO en `evidence[]`
- AND si no hay chunks del template entre los top hits, `evidence[]` MUST ser el resultado normal sin re-rank

#### Scenario: Re-rank con 0 chunks del template en resultado

- GIVEN que el template fue creado sin secciones con sampleContent (0 chunks indexados)
- WHEN `runPipeline` ejecuta con ese `templateId`
- THEN `reRankWithTemplate` MUST retornar los hits sin modificar (no hay nada que mover al top)
- AND el sistema MUST funcionar normalmente (sin error)

#### Scenario: Template de otro workspace ignorado

- GIVEN `templateId` de un template que pertenece a workspaceB
- AND el request viene de workspaceA
- WHEN el retrieval busca chunks con `sourceTemplateId === templateId`
- THEN MUST NOT retornar ningún chunk (porque los chunks tienen `workspaceId = workspaceB`)
- AND el re-rank MUST dejar el resultado sin modificar (tenant isolation natural por workspaceId en la query de retrieval)

---

### Requirement: Indicador visual en el editor

Cuando hay un template activo, el editor MUST comunicarlo visualmente al usuario.

#### Scenario: Badge de template activo

- GIVEN `activeTemplate = { id: '...', name: 'Cláusulas Laborales' }`
- WHEN el editor está en pantalla
- THEN MUST mostrarse un indicador visual junto a `DocumentTypeBadge` existente
  con texto: "Plantilla: Cláusulas Laborales"
- AND el indicador MUST tener un botón (✕) para limpiar el template activo sin abrir el dropdown

#### Scenario: Sin template activo — sin indicador

- GIVEN `activeTemplate = null`
- WHEN el editor está en pantalla
- THEN MUST NO mostrarse ningún indicador de plantilla
- AND el espacio del toolbar MUST NO verse desplazado

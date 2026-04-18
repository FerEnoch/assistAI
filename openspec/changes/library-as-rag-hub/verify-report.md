## Verification Report

**Change**: `library-as-rag-hub`  
**Version**: N/A  
**Mode**: Standard (non-Strict TDD)  
**Date**: 2026-04-18

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 47 |
| Tasks complete (`[x]`) | 10 |
| Tasks incomplete (`[ ]`) | 37 |

**Incomplete tasks status**: ⚠️ `37/47` tasks remain unchecked in `tasks.md`. Several are implemented in code, but the task artifact is not up to date and cannot be considered complete by checklist criteria.

---

### Build & Tests Execution

**Build**: ➖ Skipped (project rule in `AGENTS.md`: "Never build after changes")

**Typecheck**: ✅ Passed
```bash
pnpm typecheck
# Scope: 5/6 workspace projects
# apps/web ✅, packages/shared ✅, packages/entities ✅, apps/api ✅, apps/worker ✅
```

**Tests**: ✅ Passed
```bash
pnpm test

packages/shared:  5 files,  68 tests passed
apps/web:         5 files,  63 tests passed
apps/api:        28 files, 279 tests passed
apps/worker:     10 files, 107 tests passed

TOTAL: 48 test files, 517 tests passed, 0 failed
```

**Coverage**: ➖ Not available (no `rules.verify.coverage_threshold`, no configured coverage command in OpenSpec config)

---

### Spec Compliance Matrix

> Criterio aplicado: un escenario se marca ✅ COMPLIANT solo si hay test pasando que lo valide en runtime.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| library-navigation | Login exitoso redirige a `/library` | (none found) | ❌ UNTESTED |
| library-navigation | Sesión activa en `/` redirige a `/library` | (none found) | ❌ UNTESTED |
| library-navigation | Ruta desconocida redirige a `/library` | (none found) | ❌ UNTESTED |
| library-navigation | Acceso directo a `/dashboard` redirige | (none found) | ❌ UNTESTED |
| library-navigation | Click logo navega a `/library` | (none found) | ❌ UNTESTED |
| library-ui | Usuario autenticado aterriza en Library | (none found) | ❌ UNTESTED |
| library-ui | Empty state sin templates ni Drive | (none found) | ❌ UNTESTED |
| library-ui | Menú "Nuevo template" con 3 opciones | (none found) | ❌ UNTESTED |
| library-ui | Importar Drive sin conexión muestra CTA contextual | `apps/web/src/pages/__tests__/DashboardPage.test.ts` (lógica relacionada parcial) | ⚠️ PARTIAL |
| library-ui | Drive conectado muestra badge | (none found) | ❌ UNTESTED |
| library-ui | Acción Drive sin conexión muestra CTA contextual | `apps/web/src/pages/__tests__/DashboardPage.test.ts` (lógica relacionada parcial) | ⚠️ PARTIAL |
| library-ui | Retorno OAuth `?source=connected` refetch + limpia URL | (none found) | ❌ UNTESTED |
| library-ui | IndexingStatus visible en Library | (none found) | ❌ UNTESTED |
| template-corpus | Asociación automática al crear template desde archivo/drive | `apps/api/src/template/__tests__/template.service.test.ts > createFromUpload/createFromDrive` | ✅ COMPLIANT |
| template-corpus | Cascade delete al eliminar template | (none found) | ❌ UNTESTED |
| template-corpus | Cascade delete al eliminar documento | (none found) | ❌ UNTESTED |
| template-corpus | Asociación manual exitosa desde selector | (none found) | ❌ UNTESTED |
| template-corpus | Documento ya asociado no aparece en selector | (none found) | ❌ UNTESTED |
| template-corpus | Desasociación exitosa (sin borrar documento) | `apps/api/src/template/__tests__/template.controller.test.ts > DELETE ...` | ⚠️ PARTIAL |
| template-corpus | Template sin corpus muestra "Sin corpus" + CTA | (none found) | ❌ UNTESTED |
| template-corpus | Template con corpus muestra N docs + estado | (none found) | ❌ UNTESTED |
| template-corpus | GET `/templates/:id/documents` retorna lista | (none found) | ❌ UNTESTED |
| template-corpus | POST `/templates/:id/documents` asocia | (none found) | ❌ UNTESTED |
| template-corpus | DELETE `/templates/:id/documents/:docId` desasocia | `apps/api/src/template/__tests__/template.controller.test.ts > DELETE ...` | ⚠️ PARTIAL |
| template-corpus | Acceso cross-workspace rechazado con 403 | `apps/api/src/template/__tests__/template.controller.test.ts > GET/POST 403` | ⚠️ PARTIAL |
| template-from-drive | Drive conectado muestra picker | (none found) | ❌ UNTESTED |
| template-from-drive | Drive no conectado muestra flujo de conexión | (none found) | ❌ UNTESTED |
| template-from-drive | Crear template desde Drive crea doc + enqueue + asociación | `apps/api/src/template/__tests__/template.service.test.ts > createFromDrive` | ✅ COMPLIANT |
| template-from-drive | Picker single-select sin carpetas | (none found) | ❌ UNTESTED |
| template-from-drive | POST `/templates/from-drive` válido retorna 201 | (none found) | ❌ UNTESTED |
| template-from-drive | `fileId` inexistente retorna 404 | (none found) | ❌ UNTESTED |
| template-from-drive | `sourceId` otro workspace retorna 403 | (none found) | ❌ UNTESTED |
| template-from-file | Upload exitoso crea template+doc+asociación | `apps/api/src/template/__tests__/template.service.test.ts > createFromUpload` | ⚠️ PARTIAL |
| template-from-file | >20MB retorna 413 + mensaje UI | (none found) | ❌ UNTESTED |
| template-from-file | MIME no soportado retorna 415 + mensaje UI | (none found) | ❌ UNTESTED |
| template-from-file | Nombre requerido deshabilita confirmar | (none found) | ❌ UNTESTED |
| template-from-file | POST `/templates/from-upload` válido retorna 201 | (none found) | ❌ UNTESTED |
| template-from-file | Sin autenticación retorna 401 | (none found) | ❌ UNTESTED |
| template-from-file | Sin campo `file` retorna 400 | (none found) | ❌ UNTESTED |

**Compliance summary**: `2 / 39` escenarios con evidencia de cumplimiento por test runtime.  
Adicionalmente: `6 / 39` parciales, `31 / 39` sin evidencia de test.

---

### Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| library-navigation: redirects a `/library` | ✅ Implemented | `App.tsx`, `LoginPage.tsx`, `VerifyPage.tsx`, logo link actualizado |
| library-ui: Library como pantalla principal + drive/indexing | ⚠️ Partial | Existe integración en `LibraryPage`, pero falta manejo de `?source=connected` (refetch + URL cleanup) |
| template-corpus: join table + M:N + endpoints | ⚠️ Partial | Tabla/entidad/endpoints implementados; para template cross-workspace hoy el servicio tiende a `404` (vía `findOne`) en lugar de `403` explícito |
| template-from-drive: creación desde Drive | ⚠️ Partial | `createFromDrive` implementado con reutilización de documento; no hay chequeo real de existencia remota de `fileId` para emitir `404` |
| template-from-file: creación desde upload multipart | ⚠️ Partial | Endpoint y validaciones MIME/size/file implementadas; DTO no contempla parseo de `sections` JSON como especifica el delta |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D-1 eliminar `/dashboard` y redirigir a `/library` | ✅ Yes | Dashboard fuera de rutas; redirect legacy presente |
| D-2 Drive connection en Library | ✅ Yes | Lógica de fuente Drive vive en `LibraryPage` |
| D-3 tabla `template_documents` M:N explícita | ✅ Yes | Migración + entidad con PK compuesta y cascades |
| D-4 paths separados upload local / Drive | ✅ Yes | Endpoints `from-upload` y `from-drive` implementados |
| D-5 sub-recurso REST `/templates/:id/documents` | ✅ Yes | GET/POST/DELETE implementados |
| D-6 corpus por template reemplaza stats globales | ✅ Yes | UI centrada en panel de corpus por template (aunque hay estilos legacy sin uso) |

---

### Issues Found

**CRITICAL** (must fix before archive):
1. `tasks.md` desactualizado: `37/47` tareas siguen sin marcar completas.
2. Matriz de compliance con evidencia insuficiente: `31` escenarios críticos en estado ❌ UNTESTED.
3. No hay evidencia de test para flujos clave de navegación (`/`, `*`, `/dashboard`, login redirect, logo).
4. No hay evidencia de test para validaciones API clave de `from-upload` (401/400/413/415) y `from-drive` (201/404/403).

**WARNING** (should fix):
1. `createFromDrive()` no resuelve explícitamente escenario de `fileId` inexistente en Drive (404 descriptivo).
2. Endpoints de corpus dependen de `findOne(workspace)` → para template de otro workspace cae en 404 en lugar de 403 explícito, distinto a la especificación.
3. `library-ui` requiere manejo `?source=connected` (refetch + limpiar URL) y no está implementado en `LibraryPage.tsx`.
4. Tests de `useTemplateDocuments` no son tests reales del hook (son helpers puros), por lo que no prueban transiciones de estado React en runtime.

**SUGGESTION** (nice to have):
1. Agregar tests de integración API (supertest/e2e) para cubrir semántica HTTP completa (status codes + payloads).
2. Agregar tests de routing/UI en web para garantizar contracto de navegación post-login.

---

### Verdict

**PARTIAL**

**Score**: **41 / 100**

Implementación estructural mayormente presente (migración, entidades, endpoints y UI base), con test suite general pasando; pero la verificación de cumplimiento contra specs está incompleta por alta cantidad de escenarios sin evidencia runtime y checklist de tareas desactualizado.

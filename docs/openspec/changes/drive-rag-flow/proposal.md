# Proposal: Complete Google Drive → Picker → Indexing → RAG Flow

## Intent

El flujo completo Drive→RAG existe en backend y worker, pero el frontend nunca lo activa: `DashboardPage` no detecta si hay una source conectada, `DrivePicker` nunca se renderiza y el scope OAuth impide listar archivos. Este cambio cierra esos tres gaps para que un usuario pueda conectar Drive, seleccionar archivos y recibir respuestas contextualizadas en chat.

## Scope

### In Scope
- `useSources()` hook que llama `GET /sources` y expone estado de conexión
- Refactor de `DashboardPage` para leer `?source=connected`, renderizar `DrivePicker` si hay source activa, y disparar `POST /sources/:id/select` al confirmar selección
- Cambio de scope OAuth de `drive.file` → `drive.readonly` en `DriveOAuthService`
- Tests unitarios: `useSources.test.ts`, actualización de `DashboardPage.test.tsx`

### Out of Scope
- Sincronización incremental (ya funciona en worker — no tocar)
- UI de progreso de indexación (ya existe `IndexingStatus.tsx` — no tocar)
- Multi-source / múltiples cuentas Google
- E2E tests con Playwright
- Manejo de token refresh en frontend

## Capabilities

### New Capabilities
- `source-connection-state`: Detección y exposición del estado de conexión de una source (conectada/no conectada) en el frontend, incluyendo polling o lectura del query param `?source=connected`.
- `drive-file-selection`: Flujo de selección de archivos desde el picker hasta la encola de indexación (`POST /sources/:id/select`).

### Modified Capabilities
- None

## Approach

Tres cambios independientes que se combinan:

**1. scope OAuth** — En `apps/api/src/source/drive-oauth.service.ts`, reemplazar `drive.file` por `drive.readonly` en el array de scopes. Con `drive.readonly` el picker puede listar todos los archivos del Drive, no solo los creados por la app.

**2. `useSources` hook** — Nuevo `apps/web/src/hooks/useSources.ts`. Llama `GET /sources` al montar, retorna `{ sources, isLoading, error, refetch }`. Detecta `?source=connected` con `useSearchParams` y llama `refetch()` automáticamente para forzar la lectura post-OAuth. Esto elimina la necesidad de polling: el redirect OAuth ya es el trigger.

**3. Refactor `DashboardPage`** — Consume `useSources()`. Si `sources.length > 0`, renderiza `DrivePicker` pasándole `sourceId` y un callback `onSelect`. El callback llama `POST /sources/:id/select` con los `fileIds` elegidos. Si `sources.length === 0`, muestra el botón "Conectar Drive" actual. Se limpia el `?source=connected` del URL después del refetch (opcional, mejora UX).

El flujo resultante es lineal y sin estado global: `OAuth redirect → DashboardPage detecta ?source=connected → useSources fetches GET /sources → DrivePicker recibe sourceId → usuario elige archivos → POST /sources/:id/select → worker encola discovery`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/source/drive-oauth.service.ts` | Modified | Scope `drive.file` → `drive.readonly` |
| `apps/web/src/hooks/useSources.ts` | New | Hook para `GET /sources` + manejo de `?source=connected` |
| `apps/web/src/pages/DashboardPage.tsx` | Modified | Consume `useSources`, renderiza `DrivePicker`, dispara `POST select` |
| `apps/web/src/hooks/useSources.test.ts` | New | Tests unitarios del hook |
| `apps/web/src/pages/DashboardPage.test.tsx` | Modified | Casos: no-source, post-OAuth redirect, source activa |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cambio de scope invalida tokens OAuth existentes en DB | Med | Revocar y reconectar; documentar en release notes; añadir migración que marque sources como `needs_reauth` |
| `drive.readonly` requiere re-approval en Google Cloud Console | Low | Verificar OAuth consent screen en dev; `drive.readonly` es scope sensible pero no restringido |
| `useSources` hace fetch en cada render si `?source=connected` no se limpia | Low | Usar `useRef` para marcar que el refetch ya se ejecutó, o limpiar query param con `replaceState` |
| `DrivePicker` asume `sourceId` siempre presente; falla si sources está vacío momentáneamente | Low | Guard condicional: solo renderizar `DrivePicker` cuando `sources[0]?.id` exista |

## Rollback Plan

- **scope OAuth**: revertir el string en `drive-oauth.service.ts`; usuarios existentes no se ven afectados si no reconectan.
- **frontend**: revertir `DashboardPage.tsx` al commit anterior — el botón "Conectar Drive" estático vuelve a funcionar. `useSources.ts` es un archivo nuevo sin dependencias externas; borrarlo no rompe nada.
- Feature flag opcional: envolver la lógica de `useSources` en un `VITE_ENABLE_DRIVE_PICKER=true` para poder desactivar en producción sin revertir código.

## Dependencies

- Google Cloud Console: scope `drive.readonly` debe estar habilitado en el OAuth consent screen del proyecto.
- Tokens existentes en `Source.accessToken` seguirán funcionando para usuarios que reconecten; usuarios con token viejo (`drive.file`) necesitarán reconectar para usar el picker con archivos pre-existentes.

## Success Criteria

- [ ] Usuario con source conectada ve `DrivePicker` al cargar `/dashboard` sin necesidad de hacer nada más
- [ ] Al regresar del OAuth (`/dashboard?source=connected`), el picker aparece automáticamente en < 2s sin recarga manual
- [ ] Seleccionar archivos en el picker dispara `POST /sources/:id/select` y el worker encola el discovery job
- [ ] `GET /sources/:id/files` retorna archivos del Drive del usuario (no lista vacía) con scope `drive.readonly`
- [ ] Tests de `useSources` y `DashboardPage` pasan en `vitest`

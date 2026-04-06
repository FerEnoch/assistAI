# Design: Complete Drive → Picker → Indexing → RAG Flow

## Technical Approach

Three independent, layered changes: (1) one-line OAuth scope swap in backend, (2) new `useSources` hook with fetch + query-param detection, (3) `DashboardPage` refactor to wire hook → picker → POST select. No state management library — follows existing `useState`/`useEffect`/`fetch` patterns (see `IndexingStatus.tsx`, `use-editor-session.ts`).

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| State management for sources | Custom hook `useSources` with `useState`/`useEffect` | React Query, SWR, Context | Project has zero external state libs; `IndexingStatus` uses identical `useState`+`fetch` pattern. Consistency > magic. |
| Post-OAuth one-shot refetch | `useRef(hasHandledRedirect)` + `window.history.replaceState` to clean URL | `useEffect` dep on searchParams (re-fires), sessionStorage flag | `useRef` survives re-renders without triggering them; `replaceState` avoids re-mount. Matches existing codebase pattern in `use-editor-session.ts` (cancelled ref). |
| Picker visibility | `showPicker` boolean state in `DashboardPage` | Auto-show when connected, route-based modal | User may want to see dashboard info before opening picker. Explicit button click = user intent. Spec REQ-1 says render `DrivePicker` capability, but gating behind a button is better UX. |
| `handleSelectFiles` guard | `isSubmitting` ref to prevent double POST | Disable button only via CSS | Ref check at handler level is bulletproof; complements disabled button (REQ-5, Scenario 5.3). |
| Test approach | Extract fetch logic into testable functions (same as `use-editor-session.test.ts`) | `@testing-library/react` (not installed), E2E | Project convention: no RTL, test core logic directly. See `editor/__tests__/`. |

## Data Flow

```
OAuth callback
     │
     ▼
/dashboard?source=connected
     │
     ▼
DashboardPage mounts
     │
     ├─ useSources() ──► GET /sources ──► { sources, isLoading, error, refetch }
     │      │
     │      ├─ detects ?source=connected → refetch() once → replaceState cleans URL
     │      └─ sourceConnected = sources.find(s => s.status === 'connected')
     │
     ├─ !sourceConnected → "Conectar Drive" button → redirect /sources/drive/connect
     │
     └─ sourceConnected → show email + "Seleccionar archivos" button
                │
                ▼
          showPicker=true → <DrivePicker sourceId={id} onSelect onCancel>
                │
                ▼
          handleSelectFiles(fileIds, rootLocator)
                │
                ├─ POST /sources/:id/select { rootLocator }
                ├─ close picker (showPicker=false)
                └─ set feedbackMessage → "Indexación iniciada"
                              │
                              ▼
                      <IndexingStatus /> (already auto-refreshes)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/source/drive-oauth.service.ts` | Modify | L16: `drive.file` → `drive.readonly` |
| `apps/web/src/hooks/useSources.ts` | Create | Hook: `GET /sources`, loading/error/refetch, `?source=connected` handling |
| `apps/web/src/pages/DashboardPage.tsx` | Modify | Import `useSources` + `DrivePicker`, conditional rendering, `handleSelectFiles` |
| `apps/web/src/hooks/__tests__/useSources.test.ts` | Create | Unit tests for hook fetch logic |
| `apps/web/src/pages/__tests__/DashboardPage.test.ts` | Create | Unit tests for page render logic + handler |
| `apps/api/src/source/__tests__/drive-oauth.service.test.ts` | Create | Scope assertion test |

## Interfaces / Contracts

```typescript
// apps/web/src/hooks/useSources.ts

interface Source {
  id: string;
  workspaceId: string;
  sourceType: 'google_drive';
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  rootLocator: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UseSourcesReturn {
  sources: Source[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Derived (not returned, computed in DashboardPage):
// const sourceConnected = sources.find(s => s.status === 'connected') ?? null;
```

```typescript
// DashboardPage internal state
interface DashboardLocalState {
  showPicker: boolean;
  feedbackMessage: string | null;
  isSubmitting: boolean;  // useRef, not useState (no re-render needed)
}
```

```typescript
// handleSelectFiles signature (inside DashboardPage)
async function handleSelectFiles(
  fileIds: string[],
  rootLocator: string,
): Promise<void>
// calls: POST ${envConfig.apiUrl}/sources/${sourceId}/select
// body: { rootLocator }
// on success: setShowPicker(false), setFeedbackMessage('Indexación iniciada')
// on error: setFeedbackMessage('Error al iniciar indexación')
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `useSources` fetch logic (loading → success, loading → error, refetch, one-shot `?source=connected`) | Extract `fetchSources()` and `handleRedirectParam()` as pure functions. Mock `fetch`. Pattern: `editor/__tests__/use-editor-session.test.ts`. |
| Unit | `DashboardPage` render branching + `handleSelectFiles` POST logic | Test `handleSelectFiles` as standalone async fn with mocked fetch. Verify conditional logic with simple state assertions. |
| Unit | `DriveOAuthService.SCOPES` contains `drive.readonly` | Direct assertion on static property in vitest. |

## Migration / Rollout

- **Tokens**: Existing `drive.file` tokens won't list pre-existing files. Users must re-authorize. No DB migration needed — `status` stays `connected` but token scope is stale.
- **Google Cloud Console**: Add `drive.readonly` to OAuth consent screen scopes BEFORE deploying.
- **Rollback**: Revert `drive-oauth.service.ts` scope + `DashboardPage.tsx`. Delete `useSources.ts`. Zero DB changes.

## Open Questions

- [x] Should `DrivePicker` auto-open when `?source=connected` arrives, or require user click? → **User click** (explicit intent, avoids jarring UX on slow connections).

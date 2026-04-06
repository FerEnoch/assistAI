# Tasks: Complete Drive → Picker → Indexing → RAG Flow

## Phase 1: Backend — OAuth scope change (quick win)

- [ ] **T-1.1** Change OAuth scope in `DriveOAuthService`
  - File: `apps/api/src/source/drive-oauth.service.ts`
  - Line 16: replace `'https://www.googleapis.com/auth/drive.file'` with `'https://www.googleapis.com/auth/drive.readonly'`
  - Update JSDoc on L7 and L14 to say `drive.readonly` instead of `drive.file`

- [ ] **T-1.2** Test: verify new scope in `getAuthorizationUrl()`
  - File: `apps/api/src/source/__tests__/drive-oauth-scope.test.ts` (create)
  - Assert `DriveOAuthService.SCOPES` (or the generated URL) includes `drive.readonly` and does NOT include `drive.file`
  - Pattern: direct property access + `expect(url).toContain('drive.readonly')`

## Phase 2: `useSources` hook

- [ ] **T-2.1** Create `apps/web/src/hooks/useSources.ts`
  - Define `Source` interface matching `ContentSource` entity (id, workspaceId, sourceType, status, rootLocator, lastSyncedAt, createdAt, updatedAt)
  - Define `UseSourcesReturn` interface: `{ sources: Source[], isLoading: boolean, error: string | null, refetch: () => void }`
  - Implement `useSources()`:
    - `useState<Source[]>([])`, `useState<boolean>(true)`, `useState<string | null>(null)`
    - `fetchSources` as `useCallback(async () => { ... }, [])` — calls `GET ${envConfig.apiUrl}/sources` with `{ credentials: 'include' }`
    - `useEffect(() => { fetchSources() }, [fetchSources])` on mount
    - Export `fetchSources` logic as standalone function `fetchSourcesFromApi(apiUrl: string, fetchFn: typeof fetch)` for testability

- [ ] **T-2.2** Add `?source=connected` detection to `useSources`
  - Import `useSearchParams` from `react-router-dom`
  - Add `useRef(false)` as `hasHandledRedirect`
  - In a second `useEffect`: if `searchParams.get('source') === 'connected'` AND `!hasHandledRedirect.current`:
    - Set `hasHandledRedirect.current = true`
    - Call `refetch()`
    - Call `window.history.replaceState({}, '', '/dashboard')` to clean URL
  - This effect runs AFTER the initial fetch `useEffect`

- [ ] **T-2.3** Test: `useSources` — loading state
  - File: `apps/web/src/hooks/__tests__/useSources.test.ts` (create)
  - Test `fetchSourcesFromApi` with a mock fetch that never resolves → verify it was called with correct URL and credentials
  - Pattern: same as `editor/__tests__/use-editor-session.test.ts` (extract logic, test directly)

- [ ] **T-2.4** Test: `useSources` — returns sources from API
  - Mock `fetch` to return `[{ id: 'src-1', status: 'connected', sourceType: 'google_drive', ... }]`
  - Call `fetchSourcesFromApi` → assert return value matches mock

- [ ] **T-2.5** Test: `useSources` — error handling
  - Mock `fetch` to return `{ ok: false, status: 500 }` or throw network error
  - Call `fetchSourcesFromApi` → assert it throws/returns error string

- [ ] **T-2.6** Test: `useSources` — `?source=connected` triggers refetch once
  - Test `handleRedirectParam()` extracted function:
    - Input: `searchParams.get('source') === 'connected'`, `hasHandledRef = { current: false }`
    - Assert: calls `refetch`, sets `hasHandledRef.current = true`, calls `replaceState`
    - Second call: assert `refetch` is NOT called again

## Phase 3: `DashboardPage` refactor

- [ ] **T-3.1** Import `useSources` and `DrivePicker` in `DashboardPage`
  - File: `apps/web/src/pages/DashboardPage.tsx`
  - Add: `import { useSources } from '../hooks/useSources'`
  - Add: `import { DrivePicker } from '../components/DrivePicker'`
  - Destructure: `const { sources, isLoading, error, refetch } = useSources()`
  - Derive: `const sourceConnected = sources.find(s => s.status === 'connected') ?? null`

- [ ] **T-3.2** Add local state for picker and feedback
  - `const [showPicker, setShowPicker] = useState(false)`
  - `const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)`
  - `const isSubmittingRef = useRef(false)`

- [ ] **T-3.3** Render loading state
  - In the "Fuentes de documentos" section:
  - If `isLoading`: render `<p>Cargando fuentes...</p>` instead of button or picker

- [ ] **T-3.4** Render error state
  - If `error`: render `<p style={styles.error}>{error}</p>` with retry button calling `refetch()`

- [ ] **T-3.5** Render: no source connected → "Conectar Drive" button (existing behavior)
  - If `!sourceConnected && !isLoading && !error`: keep existing `handleConnectDrive` button

- [ ] **T-3.6** Render: source connected → email + action buttons
  - If `sourceConnected`:
    - Show connected email: `sourceConnected.rootLocator ?? 'Cuenta conectada'`
    - Show "Seleccionar archivos" button → `onClick={() => setShowPicker(true)}`
    - Show "Desconectar" button (disabled, placeholder — out of scope per proposal)
  - Show `feedbackMessage` if non-null (auto-dismiss after 5s with `useEffect` + `setTimeout`)

- [ ] **T-3.7** Render `<DrivePicker>` when `showPicker === true`
  - `<DrivePicker sourceId={sourceConnected.id} onSelect={handleSelectFiles} onCancel={() => setShowPicker(false)} />`
  - Only render when `sourceConnected` is truthy AND `showPicker` is true

- [ ] **T-3.8** Implement `handleSelectFiles` handler
  - Signature: `async (fileIds: string[], rootLocator: string) => void`
  - Guard: if `isSubmittingRef.current` return early
  - Set `isSubmittingRef.current = true`
  - `POST ${envConfig.apiUrl}/sources/${sourceConnected.id}/select` with `{ rootLocator }`, `credentials: 'include'`, `Content-Type: application/json`
  - On success: `setShowPicker(false)`, `setFeedbackMessage('Indexación iniciada')`
  - On error: `setFeedbackMessage('Error al iniciar la indexación. Intentá de nuevo.')`
  - Finally: `isSubmittingRef.current = false`

- [ ] **T-3.9** Test: `DashboardPage` — handler `handleSelectFiles` calls POST
  - File: `apps/web/src/pages/__tests__/DashboardPage.test.ts` (create)
  - Extract `handleSelectFiles` logic into testable function `submitFileSelection(apiUrl, sourceId, rootLocator, fetchFn)`
  - Mock `fetch` → assert called with `POST`, correct URL, correct body `{ rootLocator }`
  - Assert returns `{ ok: true }` → feedback = 'Indexación iniciada'

- [ ] **T-3.10** Test: `handleSelectFiles` — error case
  - Mock `fetch` → returns `{ ok: false }`
  - Assert feedback = error message
  - Assert picker NOT closed (for retry per Scenario 5.2)

- [ ] **T-3.11** Test: `handleSelectFiles` — double-submit prevention
  - Set `isSubmittingRef.current = true` before calling
  - Assert `fetch` is NOT called

- [ ] **T-3.12** Test: conditional rendering logic
  - Test `getSourceSectionState(sources, isLoading, error)` → returns `'loading' | 'error' | 'disconnected' | 'connected'`
  - Input `isLoading=true` → 'loading'
  - Input `error='fail'` → 'error'
  - Input `sources=[]` → 'disconnected'
  - Input `sources=[{status:'connected'}]` → 'connected'

## Phase 4: Integration smoke test (manual)

- [ ] **T-4.1** Verify full flow end-to-end
  - Start dev environment
  - Navigate to `/dashboard` → see "Conectar Drive"
  - Click connect → OAuth → redirect to `/dashboard?source=connected`
  - Verify picker becomes available, email shown
  - Open picker → select files → confirm
  - Verify `IndexingStatus` shows new documents in queue

## Implementation Order

```
T-1.1 → T-1.2 (independent, can start first)
T-2.1 → T-2.2 → T-2.3..T-2.6 (hook tests can run in parallel)
T-3.1 → T-3.2 → T-3.3..T-3.8 (sequential page build)
T-3.9..T-3.12 (page tests, after T-3.8)
T-4.1 (after all above)
```

Total: **20 tasks** across 4 phases.

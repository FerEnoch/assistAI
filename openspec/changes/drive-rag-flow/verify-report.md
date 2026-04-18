# Verification Report

**Change**: drive-rag-flow  
**Mode**: Standard (non-Strict-TDD; `strict_tdd` not configured in `docs/openspec/config.yaml`)

---

## Completeness

| Metric | Value |
|---|---:|
| Tasks total | 20 |
| Completed (implemented and verifiable) | 17 |
| Partial / deviated from plan | 2 |
| Manual pending | 1 |

### Incomplete or partial tasks

- **T-3.5 (partial)**: “No source connected → Conectar Drive” exists, but not as an explicit standalone branch in the “Fuentes” section for all states.
- **T-2.2 (deviation)**: redirect-cleanup path uses `/library` (not `/dashboard`) and backend still redirects to `/dashboard?source=connected`; behavior works around a route redirect but differs from spec/task wording.
- **T-4.1 (manual)**: integration smoke flow was not executed in this verification run.

---

## Build & Tests Execution

**Typecheck**: ✅ Passed  
Command: `pnpm -r run typecheck`

**API tests**: ✅ Passed  
Command: `pnpm --filter @assistai/api test -- src/source/__tests__/drive-oauth.service.test.ts`  
Result: `28` files passed, `279` tests passed, `0` failed

**Web tests**: ✅ Passed  
Command: `pnpm --filter @assistai/web test -- src/hooks/__tests__/useSources.test.ts src/pages/__tests__/DashboardPage.test.ts`  
Result: `5` files passed, `63` tests passed, `0` failed

**Coverage**: ➖ Not available (no coverage command/threshold configured in `docs/openspec/config.yaml`)

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-1 | 1.1 Source already connected on load | (none mapped directly to render behavior) | ❌ UNTESTED |
| REQ-1 | 1.2 No sources connected on load | `apps/web/src/pages/__tests__/DashboardPage.test.ts > getSourceSectionState returns disconnected` | ⚠️ PARTIAL |
| REQ-1 | 1.3 Loading indicator while fetching | `apps/web/src/pages/__tests__/DashboardPage.test.ts > getSourceSectionState returns loading` | ⚠️ PARTIAL |
| REQ-1 | 1.4 API error on fetch | `apps/web/src/pages/__tests__/DashboardPage.test.ts > getSourceSectionState returns error` | ⚠️ PARTIAL |
| REQ-2 | 2.1 `?source=connected` triggers refetch | `apps/web/src/hooks/__tests__/useSources.test.ts > handleRedirectParam calls refetch` | ⚠️ PARTIAL |
| REQ-2 | 2.2 One-shot refetch + URL cleanup | `apps/web/src/hooks/__tests__/useSources.test.ts > one-shot guard` | ⚠️ PARTIAL |
| REQ-2 | 2.3 `?source=connected` but no source | (none mapped) | ❌ UNTESTED |
| REQ-3 | 3.1 Successful fetch contract | `apps/web/src/hooks/__tests__/useSources.test.ts > returns the sources array` | ✅ COMPLIANT |
| REQ-3 | 3.2 Network error contract | `apps/web/src/hooks/__tests__/useSources.test.ts > propagates network errors` | ✅ COMPLIANT |
| REQ-3 | 3.3 Prevent concurrent in-flight refetch | (none mapped) | ❌ UNTESTED |
| REQ-4 | 4.1 Picker selection calls `onSelect(rootLocator)` | (none mapped directly to component runtime) | ❌ UNTESTED |
| REQ-4 | 4.2 Picker close without selection no POST | (none mapped) | ❌ UNTESTED |
| REQ-4 | 4.3 No connected source => no picker | `apps/web/src/pages/__tests__/DashboardPage.test.ts > disconnected state helper` | ⚠️ PARTIAL |
| REQ-5 | 5.1 Successful submission to `/sources/:id/select` | `apps/web/src/pages/__tests__/DashboardPage.test.ts > calls POST /sources/:id/select` | ⚠️ PARTIAL |
| REQ-5 | 5.2 Failed submission keeps retry path | `apps/web/src/pages/__tests__/DashboardPage.test.ts > on error picker not closed` | ⚠️ PARTIAL |
| REQ-5 | 5.3 Double-submit prevention | `apps/web/src/pages/__tests__/DashboardPage.test.ts > does NOT dispatch second fetch` | ✅ COMPLIANT |
| REQ-5 | 5.4 Valid `sourceId` resolution | (indirect via guarded source checks, no dedicated test) | ⚠️ PARTIAL |
| REQ-6 | 6.1 OAuth scope `drive.readonly` only | `apps/api/src/source/__tests__/drive-oauth.service.test.ts > includes readonly / excludes drive.file` | ✅ COMPLIANT |
| REQ-6 | 6.2 Old token insufficient scope => `needs_reauth` | (no dedicated test proving 403 path marks needs_reauth) | ❌ UNTESTED |
| REQ-6 | 6.3 GCP OAuth scope prereq before release | deployment precondition | ➖ MANUAL |

**Compliance summary**: **4/20 compliant**, **9 partial**, **6 untested**, **1 manual**.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|---|---|---|
| REQ-1 | ⚠️ Partial | Source state branches exist in `LibraryPage`, but no test proves actual render swap between button/picker in mounted component runtime. |
| REQ-2 | ⚠️ Partial | `useSources` has query-param handling, but API callback redirects to `/dashboard?source=connected` while app route redirects `/dashboard` → `/library`; this weakens end-to-end certainty of query-trigger behavior. |
| REQ-3 | ⚠️ Partial | Hook contract implemented; concurrent in-flight guard for `refetch()` is not implemented/proven. |
| REQ-4 | ⚠️ Partial | `DrivePicker` wiring exists with `sourceId` + callbacks, but scenario-level behavioral tests are missing. |
| REQ-5 | ✅ Implemented | POST select flow, success/error feedback, and double-submit guard are present in `LibraryPage`. |
| REQ-6 | ⚠️ Partial | Scope migration done; `needs_reauth` code path exists in controller/service but lacks runtime verification test. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| OAuth scope switch to `drive.readonly` | ✅ Yes | Implemented exactly in `DriveOAuthService.SCOPES`. |
| `useSources` hook as source state owner | ✅ Yes | Hook exists and is consumed in `LibraryPage`. |
| Dashboard-centric implementation plan | ⚠️ Deviated | Implementation was migrated to `LibraryPage`; tasks/design still reference `DashboardPage`, reducing traceability. |
| One-shot post-OAuth refetch | ⚠️ Partial | Implemented in hook, but callback route and frontend route alias mismatch introduces ambiguity. |

---

## Issues Found

### CRITICAL

1. **REQ-2 route mismatch risk**: API callback redirects to `/dashboard?source=connected` while frontend route immediately navigates to `/library`; this can drop/alter query-param-driven logic and undermines scenario 2.x guarantees.
2. **REQ-6 Scenario 6.2 not proven**: no passing test shows 403/insufficient-scope on `GET /sources/:id/files` marks source as `needs_reauth`.

### WARNING

1. Several scenarios are only helper-level tested (not component/runtime behavior), especially REQ-1 and REQ-4.
2. Tasks/spec/design still mention `DashboardPage` while implementation is in `LibraryPage`.
3. `refetch()` single in-flight guarantee (REQ-3.3) is not explicitly implemented or tested.

### SUGGESTION

1. Add integration-level tests for `LibraryPage` rendering branches (loading/error/disconnected/connected and picker visibility).
2. Add controller test for `listDriveFiles` 403 path asserting `markNeedsReauth` is called.
3. Align callback URL and frontend route strategy (`/library?source=connected` or preserve query through redirect).

---

## Verdict

**PARTIAL**

Implementation and quality checks are mostly healthy (tests/typecheck pass), but spec compliance is incomplete due missing behavioral evidence and two critical gaps (post-OAuth route mismatch risk and unproven `needs_reauth` handling).

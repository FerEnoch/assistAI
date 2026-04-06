# Source Connection State Specification

## Purpose

Define cómo el frontend detecta y expone el estado de conexión de una `ContentSource` Google Drive, incluyendo la detección post-OAuth via query param.

---

## Requirements

### Requirement: REQ-1 — Dashboard MUST detect connected sources on load

The system MUST call `GET /sources` when `DashboardPage` mounts and expose the result via `useSources()`. If the response contains at least one source with `status: 'connected'`, the dashboard MUST render `<DrivePicker>` instead of the "Conectar Drive" button.

#### Scenario 1.1: Source already connected on load

- GIVEN the user navigates to `/dashboard`
- AND `GET /sources` returns `[{ status: 'connected', ... }]`
- WHEN the component mounts
- THEN `<DrivePicker>` MUST be rendered
- AND the "Conectar Drive" button MUST NOT be visible

#### Scenario 1.2: No sources connected on load

- GIVEN the user navigates to `/dashboard`
- AND `GET /sources` returns `[]`
- WHEN the component mounts
- THEN the "Conectar Drive" button MUST be rendered
- AND `<DrivePicker>` MUST NOT be rendered

#### Scenario 1.3: Loading state while fetching

- GIVEN `GET /sources` has not yet resolved
- WHEN `useSources()` is in `isLoading: true`
- THEN neither `<DrivePicker>` nor the "Conectar Drive" button MUST be shown
- AND a loading indicator MUST be visible

#### Scenario 1.4: API error on fetch

- GIVEN `GET /sources` returns a non-2xx response
- WHEN `useSources()` resolves with `error` set
- THEN the UI MUST display an error state
- AND MUST NOT crash or render an empty screen

---

### Requirement: REQ-2 — Post-OAuth redirect MUST trigger immediate source detection

When the user is redirected back to `/dashboard?source=connected` after completing Google OAuth, the system MUST trigger a `GET /sources` fetch immediately and display `<DrivePicker>` in less than 2 seconds without requiring a manual page reload.

#### Scenario 2.1: Arriving with `?source=connected`

- GIVEN the user is redirected to `/dashboard?source=connected`
- WHEN `useSources()` detects the query param on mount
- THEN `refetch()` MUST be called automatically
- AND `<DrivePicker>` MUST render once the response confirms `status: 'connected'`

#### Scenario 2.2: Query param triggers only one refetch

- GIVEN the user arrives at `/dashboard?source=connected`
- WHEN `refetch()` is called once and completes
- THEN subsequent renders MUST NOT trigger additional `GET /sources` calls
- AND the URL query param SHOULD be cleared from the address bar

#### Scenario 2.3: `?source=connected` but no source found

- GIVEN the user arrives at `/dashboard?source=connected`
- AND `GET /sources` returns `[]` (race condition or OAuth failure)
- WHEN `useSources()` resolves
- THEN the "Conectar Drive" button MUST be shown
- AND no `<DrivePicker>` MUST be rendered

---

### Requirement: REQ-3 — `useSources()` MUST expose a stable contract

The `useSources()` hook MUST return `{ sources, isLoading, error, refetch }`. `isLoading` MUST be `true` during any in-flight request. `error` MUST be non-null when the last request failed. `refetch` MUST re-execute `GET /sources` without unmounting the component.

#### Scenario 3.1: Successful fetch

- GIVEN `GET /sources` returns a 200 with a sources array
- WHEN `useSources()` resolves
- THEN `sources` MUST equal the response array
- AND `isLoading` MUST be `false`
- AND `error` MUST be `null`

#### Scenario 3.2: Network error

- GIVEN the network request fails
- WHEN `useSources()` rejects
- THEN `error` MUST be non-null
- AND `isLoading` MUST be `false`
- AND `sources` MUST be `[]`

#### Scenario 3.3: `refetch()` while previous request is in-flight

- GIVEN `isLoading` is `true`
- WHEN `refetch()` is called again
- THEN only one concurrent request MUST be in-flight
- AND the hook MUST not enter an inconsistent state

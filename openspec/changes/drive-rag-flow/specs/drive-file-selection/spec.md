# Drive File Selection Specification

## Purpose

Define el flujo de selección de archivos/carpetas desde `DrivePicker` hasta la encola de indexación via `POST /sources/:id/select`.

---

## Requirements

### Requirement: REQ-4 — User MUST be able to open the picker and select files

The system MUST render `<DrivePicker>` when a connected source exists, accept user file/folder selection, and pass the result to a handler. `<DrivePicker>` MUST receive `sourceId` and an `onSelect(rootLocator: string)` callback as props.

#### Scenario 4.1: Picker opens and user selects a file

- GIVEN `<DrivePicker>` is rendered with a valid `sourceId`
- WHEN the user interacts with the picker and selects a file or folder
- THEN `onSelect` MUST be called with the selected `rootLocator`

#### Scenario 4.2: Picker closed without selection

- GIVEN `<DrivePicker>` is rendered
- WHEN the user dismisses the picker without selecting
- THEN `onSelect` MUST NOT be called
- AND no `POST /sources/:id/select` request MUST be made

#### Scenario 4.3: `DrivePicker` rendered without a connected source

- GIVEN `sources` is `[]` or all sources have `status !== 'connected'`
- WHEN `DashboardPage` renders
- THEN `<DrivePicker>` MUST NOT be rendered

---

### Requirement: REQ-5 — Selection MUST trigger indexing via `POST /sources/:id/select`

When the user confirms a selection in `<DrivePicker>`, the system MUST call `POST /sources/:id/select` with body `{ rootLocator }`. On success, the system MUST provide feedback to the user indicating that indexing has started.

#### Scenario 5.1: Successful submission

- GIVEN the user selects a `rootLocator` in the picker
- WHEN `handleSelectFiles(rootLocator)` is called
- THEN `POST /sources/:id/select` MUST be called with `{ rootLocator }`
- AND on a 2xx response, the UI MUST show feedback (e.g., scroll to `IndexingStatus` or display a confirmation message)

#### Scenario 5.2: Submission fails

- GIVEN `POST /sources/:id/select` returns a non-2xx response
- WHEN the handler receives the error
- THEN an error message MUST be displayed to the user
- AND the picker MUST remain accessible for retry

#### Scenario 5.3: Submission in-flight (double submit prevention)

- GIVEN `POST /sources/:id/select` is in-flight
- WHEN the user attempts to trigger a second submission
- THEN the second call MUST NOT be dispatched
- AND the picker MUST be visually disabled or the submit control non-interactive

#### Scenario 5.4: `sourceId` resolves from first connected source

- GIVEN `sources` contains one or more entries
- WHEN `handleSelectFiles` is invoked
- THEN `POST /sources/sources[0].id/select` MUST be used
- AND the call MUST NOT be made with an undefined or null `sourceId`

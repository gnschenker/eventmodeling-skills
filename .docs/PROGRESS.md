# Todo List App — Implementation Progress

> **How to use this file**
> - Agents: read this before starting any work to know the current state.
> - After a slice PR is merged: change status to `done` and add a lessons-learned entry if anything is worth recording.
> - Keep lessons concise — focus on decisions and gotchas that the next agent should know about.

---

## Slice status

| Slice | Type | Status |
|---|---|---|
| `create-todo-list` | state_change | done |
| `rename-todo-list` | state_change | done |
| `archive-todo-list` | state_change | done |
| `delete-todo-list` | state_change | done |
| `create-todo` | state_change | done |
| `edit-todo` | state_change | done |
| `set-due-date-on-todo` | state_change | done |
| `complete-todo` | state_change | done |
| `reopen-todo` | state_change | done |
| `delete-todo` | state_change | pending |
| `view-my-todo-lists` | state_view | done |
| `view-todo-list-detail` | state_view | done |
| `view-active-todos` | state_view | pending |
| `view-completed-todos` | state_view | pending |
| `view-overdue-todos` | state_view | pending |
| `view-todo-detail` | state_view | pending |
| `view-notification-history` | state_view | pending |
| `send-due-date-reminder-notification` | automation | pending |
| `auto-mark-overdue-todos` | automation | pending |

---

## Lessons learned

_Entries are added here after each slice is merged. Format:_

```
### <slice-folder-name> — <date merged>
- <lesson or decision worth recording>
```

### create-todo-list — 2026-03-02
- **Handler injection pattern**: `handler.js` has zero infrastructure imports — it receives `store` as a required `{ store }` parameter. `route.js` imports `store` and passes it in. This keeps handler unit-testable without `npm install` and must be followed by all future slices.
- **`backend/errors.js`**: shared `ValidationError` class — import from here rather than re-defining per slice.
- **`frontend/config.js`**: shared `API_BASE` — import from here for all `fetch` calls.
- **All `import` statements in `server.js` must be at the top** (before any `const`/`if`/`app.*`). ESM hoists imports but ESLint `import/first` will flag mid-file imports.
- **Custom event names** are prefixed with the component abbreviation (`ctl-created`, `ctl-cancel`) to avoid collisions across slices.

### rename-todo-list — 2026-03-02
- **`query` injection**: handlers that need the DCB query builder receive it as `{ store, query }` in the deps object. `route.js` imports `query` from `es-dcb-library` and passes it in. This keeps the handler free of infrastructure imports and fully unit-testable.
- **`es-dcb-library` local stub**: `backend/lib/es-dcb-library/` is a local package registered in `package.json` as `file:./lib/es-dcb-library`. It implements `PostgresEventStore`, the `query` DSL, and `ConcurrencyError`. All future slices get the real DCB implementation via this stub without any npm registry dependency.
- **`makeQuery` unit test mock**: create a chainable plain-object proxy that satisfies the DCB API shape (`eventsOfType().where.key().equals()`) without importing the library. The mock is intentionally looser — `store.load` is mocked anyway, so the query object's value is irrelevant.
- **CSS scoping**: bare element selectors (`h2`, `label`, `button`) in shadow-DOM CSS must be scoped to the form class (e.g. `.rename-todo-list-form h2`) to avoid unintended matches on future nested elements.
- **No `observedAttributes` without `attributeChangedCallback`**: if the component only reads an attribute via `this.getAttribute()` at submission time, do not declare `observedAttributes` — it signals intent that isn't implemented.

### archive-todo-list — 2026-03-02
- **Confirmation-action pattern**: archive is a one-button action (no form fields). The component wraps a confirmation card rather than a form, but still follows the same shadow-DOM + `atl-` prefix + error-span pattern as other slices.
- **Three-event DCB query for lifecycle**: querying `TodoListCreated` + `TodoListArchived` + `TodoListDeleted` in a single `store.load` call gives the handler the full lifecycle state to enforce all three conditions (exists, not archived, not deleted) in one round-trip.
- **`archivedAt` format**: use `new Date().toISOString()` — produces a valid ISO 8601 UTC string that satisfies the EM `datetime` field type.

### delete-todo-list — 2026-03-02
- **`TodoDeleted` payload has no `listId`**: per the EM spec, `TodoDeleted` carries only `{ todoId, deletedAt }`. Querying `eventsOfType('TodoDeleted').where.key('listId').equals(listId)` returns zero rows in Postgres because no `listId` key is ever indexed in `event_keys` for those events. Any future handler that needs to reason about deleted todos must query by `todoId`, not by `listId`.
- **Two-pass load strategy when event payloads lack a shared key**: when pass 1 must collect IDs (here: `todoId`s from `TodoCreated`), and pass 2 must query a related event type that lacks the top-level key (here: `TodoDeleted` lacks `listId`), issue a second `store.load` that ORs one `(type, 'todoId', value)` matcher per collected ID. The DCB library's SQL OR expansion handles this correctly.
- **Optimistic concurrency anchored to pass 1**: use `{ query: q1, expectedVersion: version }` from the list-scoped pass. This is the correct scope — it protects against concurrent list-level writes and against new `TodoCreated` events being appended between check and append.
- **`makeStore` mock for two-pass handlers**: the test helper accepts `pass1Events`/`pass2Events`; when `pass2Events` is `null` the mock throws on any unexpected second `load` call, enforcing that pass 2 is truly skipped in error paths and in the zero-todos path.

### create-todo — 2026-03-02
- **Priority defaulting before validation**: resolve the priority to `'Medium'` when the field is absent or empty, then validate the resolved value. This avoids a false validation failure when the client omits the field.
- **list-id attribute pattern**: the `<create-todo>` Web Component reads `list-id` via `this.getAttribute('list-id')` at submit time. No `observedAttributes` needed since the attribute is only needed on submit, not on change.
- **Optimistic concurrency on the list query**: the `TodoCreated` event is appended with `{ query: q, expectedVersion: version }` where `q` covers `TodoListCreated` + `TodoListDeleted` for the given `listId`. This prevents a race between two concurrent `CreateTodo` commands on a list that gets deleted between check and append.

### edit-todo — 2026-03-02
- **No priority defaulting**: unlike `create-todo`, `EditTodo` requires an explicit valid priority — no defaulting to Medium. The handler rejects any value not in `{Low, Medium, High}`, including `undefined`.
- **`connectedCallback` guard**: `if (this.shadowRoot) return;` must be the first statement in `connectedCallback` for Web Components that call `attachShadow`. Without it, reconnecting the element (e.g. host page hide/show) throws `NotSupportedError`.
- **CSS selector scoping**: all shadow-DOM CSS selectors must be prefixed with the form class (e.g. `.edit-todo-form .field`) to prevent bleeding into nested Web Components — per `rename-todo-list` lesson, now consistently enforced from this slice onward.
- **`populate()` method**: the edit form exposes `populate({ title, description, priority })` so host pages can pre-fill fields from `TodoDetailProjection` before presenting the form.
- **DCB query anchors on `TodoCreated` + `TodoDeleted`**: the handler only needs existence/deletion state, not the full edit history. Loading only these two event types is correct and minimal.

### reopen-todo — 2026-03-02
- **Mirror of complete-todo pattern**: same five-event lifecycle fold; narrower guard (`status !== 'completed'` rather than `!== 'active' && !== 'overdue'`). The fold logic is intentionally duplicated per slice (vertical slice isolation) rather than shared.

### complete-todo — 2026-03-02
- **Status fold over lifecycle events**: load `TodoCreated + TodoCompleted + TodoReopened + TodoDeleted + TodoMarkedOverdue` and fold in order. A switch-case on event type updating a single `status` variable is the clearest pattern for multi-state lifecycle handlers.
- **POST for action routes**: `POST /todos/:todoId/complete` follows the `POST /todo-lists/:listId/archive` pattern — POST with a verb sub-resource for non-idempotent state-change actions.
- **Confirmation-action UI**: no form fields, just confirm/cancel buttons — mirrors the `archive-todo-list` pattern.

### set-due-date-on-todo — 2026-03-02
- **Lexicographic date comparison**: ISO 8601 `YYYY-MM-DD` strings compare correctly with `<` and `>=`. Today is valid (`dueDate < today` rejects only strictly past dates). No `Date` object parsing needed for a date-only comparison.
- **Sub-resource route path**: `PATCH /todos/:todoId/due-date` keeps the due-date update separate from `PATCH /todos/:todoId` (edit), avoiding ambiguity and making intent clear.
- **No `archived` check needed**: the EM business rules for this slice only specify "must exist and not be deleted" — no archived check, unlike list-scoped commands.

### view-my-todo-lists — 2026-03-02
- **Polling-based projection runner**: `backend/projection-runner.js` is the shared infrastructure for all state_view slices. Each projection exports `NAME`, `SOURCE_EVENTS`, `initSchema(client)`, and `handleEvent(event, client)`. The runner creates a `projection_checkpoints` table, calls `initSchema`, then polls `events` every 500 ms for new events above the checkpoint, processing each in its own transaction.
- **`pool` exported from `store.js`**: projections and query routes need direct pool access for SQL queries. `store.js` now exports both `pool` and `store`.
- **No npm deps in test files**: `express` and `pg` are not installed locally (only in Docker). Test files must only import local files with no npm dependencies. `query.test.js` imports from `projection.js` (no npm deps); the Express route in `query.js` is thin glue that is not unit-tested.
- **Idempotent projection inserts**: `TodoListCreated` uses `ON CONFLICT (list_id) DO NOTHING` so replaying events never duplicates rows.
- **Deleted lists are removed**: `TodoListDeleted` removes the row from `todo_lists_projection`. The list screen only shows active/archived lists.

### view-todo-list-detail — 2026-03-02
- **Deleted rows are kept (status='deleted')**: unlike TodoListsProjection (which deletes rows on `TodoListDeleted`), the detail projection marks the row as `status='deleted'`. This allows `GET /todo-lists/:listId` to return meaningful data for audit and prevents confusion between "never existed" (404) and "existed but deleted" (still 404 in current implementation, but the data is available for future 410 responses).
- **`GET /todo-lists/:listId` registered after `GET /todo-lists`**: Express matches routes in registration order. The specific `:listId` route must be registered after the bare `/todo-lists` route to avoid shadowing.

### scaffolding — 2026-03-02
- `store.js` is the single place that creates the PG pool and `PostgresEventStore`. Slice handlers import store from `../../store.js`, never from `server.js` — importing `server.js` would trigger port binding and break tests.
- CORS is configured in `server.js` with `FRONTEND_ORIGIN` env var (defaults to `http://localhost:8080`).
- `node --watch` (Node 20 built-in) is the dev server — no nodemon needed.
- `test:unit` / `test:integration` scripts filter by `--test-name-pattern`; test names must include the word "unit" or "integration" accordingly.

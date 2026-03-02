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
| `delete-todo` | state_change | done |
| `view-my-todo-lists` | state_view | done |
| `view-todo-list-detail` | state_view | done |
| `view-active-todos` | state_view | done |
| `view-completed-todos` | state_view | done |
| `view-overdue-todos` | state_view | done |
| `view-todo-detail` | state_view | done |
| `view-notification-history` | state_view | done |
| `send-due-date-reminder-notification` | automation | done |
| `auto-mark-overdue-todos` | automation | done |

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

### view-overdue-todos — 2026-03-02
- **TodoReopened not needed**: a reopened todo is NOT overdue until `TodoMarkedOverdue` fires again. Omitting `TodoReopened` from source events is intentional — the stale 'completed' staging row is harmless (filtered by the query) and the correct path back to 'overdue' is a fresh automation event.
- **TodoEdited in source events**: needed to keep title and priority current in the projection since both are displayed on the overdue screen.

### view-completed-todos — 2026-03-02
- **Subscribe to TodoCreated even when not in EM source_events**: `TodoCompleted` payload only has `{ todoId, completedAt }` — no title or listId. Subscribing to `TodoCreated` stages a row with those fields so `TodoCompleted` can UPDATE it. The query layer hides staging rows (status='active') by filtering `WHERE status='completed'`.
- **TodoReopened sets completed_at = NULL in SQL (not a parameter)**: Use literal SQL `NULL` to clear a nullable column: `SET completed_at = NULL`. Do not pass `null` as a parameter for `= $2` — that would set it to the Postgres NULL via binding, which works but is less readable.

### view-active-todos — 2026-03-02
- **Soft-delete on TodoCompleted**: the projection does NOT delete the row when a todo is completed. Instead it sets `status='completed'`. This preserves the row for TodoReopened to UPDATE back to 'active'. The query filters to `status IN ('active','overdue')`.
- **Hard-delete on TodoListArchived and TodoListDeleted**: both events DELETE all rows for the given `list_id` — active todos in an archived or deleted list are no longer relevant.
- **Priority ordering in SQL**: `CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END ASC` is the correct way to impose a custom sort order in PostgreSQL without a separate enum type.

### delete-todo — 2026-03-02
- **Single-pass load (unlike delete-todo-list)**: `TodoDeleted` events carry `todoId` directly, so the handler can load `TodoCreated + TodoDeleted` in a single `store.load` call — no two-pass strategy needed. The two-pass approach from `delete-todo-list` was only required because `TodoDeleted` lacked `listId`.
- **DELETE verb**: `DELETE /todos/:todoId` follows REST conventions for resource deletion, consistent with `DELETE /todo-lists/:listId`.

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

### auto-mark-overdue-todos — 2026-03-02
- **Include TodoReopened in the DCB query**: a todo can be marked overdue, then completed, then reopened (back to 'active'). If `TodoReopened` is absent from the query, the fold ends at `status='overdue'` and the job skips it — incorrect. Always include all status-changing events in the fold.
- **Daily trigger via setInterval + UTC time check**: `setInterval(fn, 60_000)` polling every minute with `utcHours===0 && utcMinutes===1` avoids external cron dependencies while precisely hitting 00:01 UTC.
- **Same two-step pattern as send-due-date-reminder-notification**: SQL projection query for candidates → DCB fold for event-level verification. The SQL filter is an optimization (avoids loading events for all todos); the DCB fold is the authoritative guard.

### send-due-date-reminder-notification — 2026-03-02
- **Automation job pattern**: `job.js` exports `runJob({ pool, store, query })` — same dependency injection as handlers, fully testable without a running server. `server.js` schedules via `setInterval` and runs once on startup.
- **`query` imported at server.js top level**: the DCB `query` builder is imported from `es-dcb-library` in `server.js` and passed to job deps. This avoids circular imports and keeps job.js free of infrastructure imports.
- **Two-step approach**: step 1 queries the projection (SQL) to find candidates; step 2 uses DCB `store.load + expectedVersion` to enforce idempotency and handle concurrency. Separation keeps each concern clean.
- **ConcurrencyError swallowing pattern**: `if (err.name !== 'ConcurrencyError')` — identified by name (not instanceof) to avoid coupling to the library's class hierarchy. Continue the loop so other todos are still processed.
- **No user model yet**: `DEMO_USER_ID` placeholder UUID documented inline. When auth is added, replace with the actual userId from the todo's owner.

### view-notification-history — 2026-03-02
- **Append-only projection**: unlike most projections, `NotificationHistoryProjection` never hard-deletes rows — notification history is immutable. Only `TodoDueReminderSent` events are handled.
- **Composite PK (todo_id, due_date)**: enforces the EM business rule "reminder must not have already been sent for this todo/due date combination" at the database level. `ON CONFLICT DO NOTHING` makes replay fully idempotent.
- **Optional todoId filter in query**: the EM specifies filtering by todoId, implemented via an optional `?todoId=` query param. When omitted, all notifications are returned (no pagination needed for this demo).

### view-todo-detail — 2026-03-02
- **Soft-delete on TodoDeleted**: unlike some other projections, `TodoDeleted` sets `status='deleted'` and keeps the row. This lets the detail view render meaningful data (status='deleted') rather than a 404 gap. Only `TodoListArchived`/`TodoListDeleted` hard-delete rows.
- **GET /todos/:todoId registered after /todos/active|completed|overdue**: Express matches routes in registration order. The parameterized `:todoId` route must come after the fixed sub-paths to avoid shadowing them.
- **Returning status='deleted' in the 200 response**: the frontend renders it with a `.status--deleted` CSS class (red). No special 410 handling was needed — the EM doesn't require it.

### scaffolding — 2026-03-02
- `store.js` is the single place that creates the PG pool and `PostgresEventStore`. Slice handlers import store from `../../store.js`, never from `server.js` — importing `server.js` would trigger port binding and break tests.
- CORS is configured in `server.js` with `FRONTEND_ORIGIN` env var (defaults to `http://localhost:8080`).
- `node --watch` (Node 20 built-in) is the dev server — no nodemon needed.
- `test:unit` / `test:integration` scripts filter by `--test-name-pattern`; test names must include the word "unit" or "integration" accordingly.

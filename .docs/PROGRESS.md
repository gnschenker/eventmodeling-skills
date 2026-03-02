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
| `rename-todo-list` | state_change | pending |
| `archive-todo-list` | state_change | pending |
| `delete-todo-list` | state_change | pending |
| `create-todo` | state_change | pending |
| `edit-todo` | state_change | pending |
| `set-due-date-on-todo` | state_change | pending |
| `complete-todo` | state_change | pending |
| `reopen-todo` | state_change | pending |
| `delete-todo` | state_change | pending |
| `view-my-todo-lists` | state_view | pending |
| `view-todo-list-detail` | state_view | pending |
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

### scaffolding — 2026-03-02
- `store.js` is the single place that creates the PG pool and `PostgresEventStore`. Slice handlers import store from `../../store.js`, never from `server.js` — importing `server.js` would trigger port binding and break tests.
- CORS is configured in `server.js` with `FRONTEND_ORIGIN` env var (defaults to `http://localhost:8080`).
- `node --watch` (Node 20 built-in) is the dev server — no nodemon needed.
- `test:unit` / `test:integration` scripts filter by `--test-name-pattern`; test names must include the word "unit" or "integration" accordingly.

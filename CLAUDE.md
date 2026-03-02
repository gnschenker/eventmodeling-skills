# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This repo has two roles:

1. **Skill pack** — Two Claude Code skills (`event-modeling`, `em-to-ui`) for modeling domains and generating UI mockups.
2. **Application workspace** — The Todo List App defined in `.docs/todo-list-app.yaml` is being implemented here slice-by-slice using the tech stack and workflow described below.

---

## Invoking the skills

```
/event-modeling   — generate an EM YAML from a business description
/em-to-ui         — generate ASCII UI mockups from an EM YAML file
```

Skills are defined in `skills/<skill-name>/SKILL.md`. Each skill reads its own
`references/` folder for patterns, schemas, and component libraries.

---

## Tech stack (Todo List App)

| Layer | Choice |
|---|---|
| Frontend | Vanilla JS, Web Components, HTML, CSS — no framework |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Event sourcing | `es-dcb-library` (aggregateless ES with DCB) |

Use libraries only when genuinely needed. Keep dependencies minimal.

---

## Architecture

### Folder structure mirrors the Event Model

The directory layout maps 1-to-1 to the slices in `.docs/todo-list-app.yaml`. Every slice
gets its own folder in both the backend and the frontend. This makes it trivial to navigate
from the EM to the code and back.

```
backend/
  slices/
    create-todo-list/
    rename-todo-list/
    archive-todo-list/
    delete-todo-list/
    create-todo/
    edit-todo/
    set-due-date-on-todo/
    complete-todo/
    reopen-todo/
    delete-todo/
    view-my-todo-lists/
    view-todo-list-detail/
    view-active-todos/
    view-completed-todos/
    view-overdue-todos/
    view-todo-detail/
    view-notification-history/
    send-due-date-reminder-notification/
    auto-mark-overdue-todos/

frontend/
  slices/
    create-todo-list/
    rename-todo-list/
    ... (same names)
```

Folder names are kebab-case versions of the EM slice `name` field. Do not reorganise by
technical layer (no `controllers/`, `services/`, `models/` folders).

Each slice folder is self-contained and holds everything needed for that slice:

**Backend slice folder** (state_change example)
```
backend/slices/create-todo/
  handler.js        — command handler: loads events, validates, appends
  route.js          — Express route wiring
  handler.test.js   — unit/integration tests
```

**Backend slice folder** (state_view example)
```
backend/slices/view-active-todos/
  projection.js     — event handler that maintains the read-side table
  query.js          — Express route + SQL query
  query.test.js
```

**Backend slice folder** (automation example)
```
backend/slices/auto-mark-overdue-todos/
  job.js            — scheduled job reading the to-do projection, issuing the command
  job.test.js
```

**Frontend slice folder**
```
frontend/slices/create-todo/
  create-todo.js    — Web Component definition
  create-todo.html  — template (if extracted)
  create-todo.css   — scoped styles (if extracted)
```

### Vertical slice architecture

Every slice in `.docs/todo-list-app.yaml` maps 1-to-1 to an implementation slice. Do not
combine or split slices. The EM is the authoritative decomposition.

Slice types and their implementation shape:

| EM slice type | Backend implementation |
|---|---|
| `state_change` | Express route → command handler → `store.append()` |
| `state_view` | Projection (event subscriber) writes to read table; route queries it |
| `automation` | Scheduled job reads to-do projection → issues command → `store.append()` |

### Aggregateless event sourcing with DCB

Use `es-dcb-library`. There are **no aggregate classes**. Do not model aggregates. State is
reconstructed on demand by loading events through the query DSL.

**Setup**
```js
import { PostgresEventStore, query } from 'es-dcb-library';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const store = new PostgresEventStore({ pool });
await store.initializeSchema();
```

**Appending an event**
```js
await store.append({ type: 'TodoCreated', payload: { todoId, listId, title, ... } });
```

**Loading events to reconstruct state (command handler)**
```js
const q = query.eventsOfType('TodoCreated').where.key('todoId').equals(todoId)
               .eventsOfType('TodoDeleted').where.key('todoId').equals(todoId);
const { events, version } = await store.load(q);
// fold events into current state, then validate business rules
```

**Optimistic concurrency**
```js
await store.append(newEvent, { query: q, expectedVersion: version });
// throws ConcurrencyError on conflict
```

**Multi-type, multi-key queries**
```js
query.eventsOfType('TypeA').where.key('field').equals(val)
     .eventsOfType('TypeB').where.key('field').equals(val)
```
`.where`, `.and`, `.or` are property getters, not method calls.

### Projections (state_view slices)

Each projection subscribes to its `source_events` list and maintains a dedicated read-side
table in PostgreSQL. Keep projection logic idempotent — replay must produce the same result.

### Frontend

Use native Web Components (`customElements.define`). No build step required. Each EM screen
(`*Screen` in the `ui` field) maps to one Web Component in the corresponding slice folder.

---

## Development commands

Run from the **repo root** unless noted otherwise.

```bash
# Start everything (Postgres + backend + frontend)
docker compose up

# Start only the database (for local backend dev)
docker compose up postgres

# Backend only (from backend/)
npm run dev        # node --watch server.js
npm test           # all tests (node:test runner)
npm run test:unit
npm run test:integration   # requires Postgres running
npm run lint

# Reset the database volume
docker compose down -v
```

`backend/` uses `"type": "module"` — all imports must use ESM syntax.
`node --watch` is the dev server (Node 20+). No external watch tool needed.

---

## Agent workflow

Implementation proceeds one EM slice at a time using two specialist agents:

### Toni — Implementation specialist
- Expert in the tech stack above and in aggregateless ES with DCB
- Takes one slice from `.docs/todo-list-app.yaml` at a time
- Works in a dedicated feature branch named `feat/<slice-folder-name>`
- Creates the slice folder(s) in `backend/slices/` and `frontend/slices/`
- Writes the implementation **and** tests before opening a PR
- Fixes all issues found by Sandy, then requests re-review

### Sandy — Code review specialist
- Thoroughly reviews Toni's PR on GitHub
- Checks: correctness, ES/DCB patterns (no aggregates), test coverage, slice isolation, no unnecessary dependencies, folder naming matches the EM slice
- Re-reviews after each round of fixes
- Merges the PR only when no issues remain

**After each merge: wait for instructions before starting the next slice.**

### Progress tracking

After Sandy merges a PR, **both agents must update `.docs/PROGRESS.md`**:

1. Mark the slice as `done` in the status table.
2. Add a "Lessons learned" entry under the slice if anything noteworthy came up during implementation or review (tricky DCB query, projection idempotency gotcha, unexpected UI edge case, etc.).

**Before starting any slice**, read `.docs/PROGRESS.md` to understand what is already done and what patterns were established in previous slices. Never re-implement a completed slice.

The file is the single source of truth for implementation progress.

---

## Event Model reference

The full EM is in `.docs/todo-list-app.yaml`. It defines:
- **10 state_change slices** — todo list and todo item CRUD + lifecycle
- **7 state_view slices** — list views, detail views, overdue screen, notification history
- **2 automation slices** — overdue detection (daily) and due-date reminders (hourly)

Generated UI mockups are in `.docs/todo-list-app-ui-mockups.md`.

---

## EM YAML conventions

- Commands: imperative PascalCase (`CreateTodo`, `CompleteTodo`)
- Events: past-tense PascalCase (`TodoCreated`, `TodoCompleted`)
- Projections: `<Descriptor>Projection` (`ActiveTodosProjection`)
- Queries: `Get<Thing>` (`GetActiveTodos`)
- `uuid` fields in payloads are system-generated — never exposed in UI forms
- Optional payload fields are annotated with `# optional`
- Enum options are annotated inline, e.g. `# Low | Medium | High`

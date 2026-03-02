# eventmodeling-skills

A [Claude Code](https://claude.ai/claude-code) skill pack for **Event Modeling** — the methodology invented by [Adam Dymitruk](https://eventmodeling.org). This pack gives Claude two complementary skills: one that produces a structured Event Model from any business description, and one that turns that model into ASCII UI wireframes.

---

## Skills

### `event-modeling` — Generate an Event Model from requirements

Point Claude at any product vision, feature spec, or business description and ask it to produce an Event Model. The skill applies the four canonical EM patterns to decompose every business process into well-defined, autonomous slices.

**Trigger phrases**
- "create an event model for..."
- "model this as an event model"
- "turn this into an EM"
- "build an event model"

**Output** — A fenced YAML block following the EM schema, plus a slice-type summary and a notes section flagging assumptions.

**Four patterns recognised**

| Pattern | Shape | When to use |
|---|---|---|
| `state_change` | Actor → Command → Event | A human makes a deliberate decision |
| `state_view` | Events → Projection → Query → UI | Information is read; nothing changes |
| `automation` | Projection(ToDo) → Job → Command → Event | System acts without a human trigger |
| `translation` | External Event → Process → Command → Internal Event | Foreign fact becomes internal truth |

---

### `em-to-ui` — Generate ASCII UI mockups from an Event Model YAML

Point Claude at an EM YAML file and ask it to generate UI mockups. The skill produces a single Markdown file containing:

- **Forms** (one per `state_change` slice) — input forms with field components, precondition banners, and validation notes
- **Screens** (one per `state_view` slice) — read screens with filter bars, list tables, and detail cards

**Trigger phrases**
- "generate UI mockups from the EM"
- "create UI mockups from event model"
- "turn the EM into UI wireframes"
- "show me the forms for the EM"

**Field-type → component mapping**

| Payload type | Component rendered |
|---|---|
| `string` (single line) | Text input |
| `string` with enum comment | Radio group (≤ 4 options) or Dropdown (> 4) |
| `string` with `description` / `notes` / `body` in name | Textarea |
| `boolean` | Checkbox |
| `date` | Date picker |
| `datetime` | Datetime picker |
| `integer` / `decimal` | Number input |
| `object` | Fieldset |
| `array<string>` | Tag input |
| `uuid` fields | Omitted (system-generated) |

**Screen types inferred from `ui` field**

| `ui` value pattern | Rendered as |
|---|---|
| `*ListScreen` | List table with filter bar |
| `*DetailScreen` | Key-value detail card |
| `*HistoryScreen` | Chronological list table with timestamp column |

---

## Project structure

```
eventmodeling-skills/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   ├── event-modeling/
│   │   ├── SKILL.md             # Skill instructions for Claude
│   │   └── references/
│   │       ├── em-output-schema.md   # YAML output schema
│   │       └── em-patterns.md        # Four EM pattern reference
│   └── em-to-ui/
│       ├── SKILL.md             # Skill instructions for Claude
│       └── references/
│           └── ui-component-patterns.md  # ASCII component library
└── .docs/
    ├── todo-list-app.yaml           # Example Event Model
    └── todo-list-app-ui-mockups.md  # Generated UI mockups
```

---

## Usage

### 1. Install the skill pack

Add this repository as a Claude Code skill pack in your project's `.claude/settings.json`, or clone it and reference it locally.

### 2. Create an Event Model

Describe your domain to Claude and invoke the skill:

```
/event-modeling

Build an event model for a hotel booking system where guests can search
for rooms, make reservations, check in and out, and leave reviews.
Staff can manage room availability and handle cancellations.
```

Claude will produce a YAML Event Model and save it as a file.

### 3. Generate UI mockups from the model

Once you have an EM YAML file, invoke the UI skill:

```
/em-to-ui on the @.docs/hotel-booking.yaml
```

Claude will write `hotel-booking-ui-mockups.md` to the same directory, containing ASCII wireframes for every form and screen in the model.

---

## Todo List App — implemented slices

| Slice | Endpoint | Frontend route |
|---|---|---|
| `create-todo-list` | `POST /todo-lists` | `#/create-todo-list` |
| `rename-todo-list` | `PATCH /todo-lists/:listId/name` | `#/rename-todo-list` |
| `archive-todo-list` | `POST /todo-lists/:listId/archive` | `#/archive-todo-list` |
| `delete-todo-list` | `DELETE /todo-lists/:listId` | `#/delete-todo-list` |
| `create-todo` | `POST /todo-lists/:listId/todos` | `#/create-todo` |
| `edit-todo` | `PATCH /todos/:todoId` | `#/edit-todo` |
| `set-due-date-on-todo` | `PATCH /todos/:todoId/due-date` | `#/set-due-date-on-todo` |
| `complete-todo` | `POST /todos/:todoId/complete` | `#/complete-todo` |
| `reopen-todo` | `POST /todos/:todoId/reopen` | `#/reopen-todo` |
| `delete-todo` | `DELETE /todos/:todoId` | `#/delete-todo` |
| `view-active-todos` | `GET /todos/active?listId=...` | `#/view-active-todos` |
| `view-completed-todos` | `GET /todos/completed?listId=...` | `#/view-completed-todos` |
| `view-my-todo-lists` | `GET /todo-lists?status=active|archived` | `#/view-my-todo-lists` |
| `view-todo-list-detail` | `GET /todo-lists/:listId` | `#/view-todo-list-detail` |

---

## Example output

The `.docs/` folder contains a worked example — a **Simple Todo List App** Event Model and its generated UI mockups:

- [`todo-list-app.yaml`](.docs/todo-list-app.yaml) — 10 state changes, 7 state views, 2 automations
- [`todo-list-app-ui-mockups.md`](.docs/todo-list-app-ui-mockups.md) — 17 ASCII mockups (10 forms + 7 screens)

---

## License

MIT

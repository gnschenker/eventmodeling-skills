---
name: em-to-ui
description: This skill should be used when the user wants to generate UI mockups from an Event Model YAML file. Triggers on phrases like "generate UI mockups from the EM", "create UI mockups from event model", "turn the EM into UI wireframes", "show me the forms for the EM", "generate ASCII mockups from", or when the user points to an EM YAML file and asks for UI components, forms, or wireframes.
version: 1.0.0
---

# EM to UI Mockups Skill

Read an Event Model YAML file and produce a Markdown file containing ASCII mockups for every `state_change` slice (input forms) and every `state_view` slice (read screens). Forms represent the input surfaces where actors issue commands; screens represent the read-side views where actors browse and inspect data.

## Purpose

Bridge the gap between a structured Event Model and UI design. `state_change` slices define deliberate human actions — commands with payloads. `state_view` slices define the read surfaces — projections with filters. This skill turns both into concrete, visual wireframes that designers and developers can immediately reason about.

## When to Use

Activate this skill when the user:
- Points to an EM YAML file and asks for UI mockups, forms, or wireframes
- Wants to visualise the input surfaces or read screens of a modelled system
- Asks to generate ASCII mockups from an Event Model
- Uses phrases like "generate UI from the EM", "show me the forms", "wireframe the commands"

## Process

### Step 1: Locate and Read the EM YAML

Read the file path provided by the user. Parse the YAML. Collect all slices from:
- `event_model.slices[]` (flat model), or
- `event_model.bounded_contexts[].slices[]` (multi-context model)

Note the `event_model.name` — use it as the H1 title of the output document.

### Step 2: Collect Slices by Type

Partition slices into two groups. Discard `automation` and `translation` slices.

**Group A — State Change slices** (`type: state_change`). For each, extract:
- `name` — human-readable slice name (used as heading)
- `actor` — the human role issuing the command
- `command.name` — used to derive the form title and submit button label
- `command.payload` — the ordered map of field names to types (and optional inline comments)
- `business_rules` — optional list of validation rules to surface as annotations
- `precondition` — optional projection/query the actor sees before acting

**Group B — State View slices** (`type: state_view`). For each, extract:
- `name` — human-readable slice name (used as heading)
- `projection` — the read model being displayed
- `query` — the query that drives the projection
- `ui` — the screen component name (used to infer screen type)
- `filters` — optional list of filter/sort descriptions
- `source_events` — the events that update this projection (used to infer displayed columns/fields)

### Step 3: Map State Change Payload Fields to UI Components

Consult `references/ui-component-patterns.md` for the full mapping table and rendering rules. Key decisions:

- **Skip** any field whose name ends in `Id` or whose type is `uuid` — these are system-generated identifiers never entered by users
- **Infer enum options** from inline YAML comments, e.g. `# Low | Medium | High` → Radio group (3 options ≤ 4)
- **Infer textarea** from field names containing: `description`, `notes`, `body`, `comment`, `detail`, `reason`
- **Mark required** with `*` unless the payload has a `# optional` comment on that field
- **Expand objects** into a labelled Fieldset with one sub-input per known sub-field; if sub-fields are unknown, render a single textarea placeholder

### Step 4: Render the ASCII Form Mockup (State Change)

For each state_change slice, produce one form mockup using the Full Form Shell from `references/ui-component-patterns.md`:

1. Open the shell with the form title (PascalCase command name split into words) and actor
2. If a `precondition` is present, render the context banner immediately inside the shell
3. Render each non-uuid payload field in order, using the correct component pattern
4. Close the shell with Cancel + Submit buttons (submit label = form title)
5. If `business_rules` are present, append the Validation notes block beneath the shell

### Step 5: Infer Screen Type and Content for State Views

For each state_view slice, determine screen type from the `ui` field:

| `ui` value pattern | Screen type |
|---|---|
| ends in `ListScreen` | **List view** — tabular rows with sortable columns |
| ends in `DetailScreen` | **Detail view** — labelled key-value card |
| ends in `HistoryScreen` | **History view** — chronological list with timestamp column |
| anything else | **List view** (default) |

**Inferring columns / fields to display:**
Use the `source_events` and the slice `name` to derive the most relevant data to show. For list views, choose 3–4 representative columns. For detail views, show all meaningful fields as key-value pairs. Derive column/field names from the events that write to the projection (e.g. `TodoCreated` implies Title, Priority, Due Date, Created At; `TodoCompleted` implies Completed At).

### Step 6: Render the ASCII Screen Mockup (State View)

For each state_view slice, produce one screen mockup using the Screen Shell from `references/ui-component-patterns.md`:

1. Open the shell with the screen title (slice `name`) and the query name
2. If `filters` are present, render a Filter Bar row inside the shell (use the ╠╣ divider to separate it from the content area)
3. Render the content area using the appropriate pattern:
   - **List view** → List Table with inferred columns and 2–3 placeholder rows
   - **Detail view** → Detail Card with inferred key-value fields
   - **History view** → List Table with a timestamp as the first column
4. Close the shell

### Step 7: Assemble and Write the Output Markdown

Compose the output document in two clearly labelled sections:

```
# <event_model.name> — UI Mockups

> Generated from: <input file path>
> State change slices: <N> | State view slices: <M>

---

# Forms — State Changes

## <slice name>

**Actor:** <actor>
**Command:** `<CommandName>`

\```
<ASCII form mockup>
\```

<Validation notes block, if any>

---

# Screens — State Views

## <slice name>

**Projection:** `<ProjectionName>`
**Query:** `<QueryName>`

\```
<ASCII screen mockup>
\```

---
```

Repeat each `##` section for every slice of its type, in the order they appear in the YAML.

Write the output file to the same directory as the input YAML file, named:
`<input-basename>-ui-mockups.md`

For example: `todo-list-app.yaml` → `todo-list-app-ui-mockups.md`

Confirm the output path to the user after writing.

## Output Format

The output is a single Markdown file divided into two `#` sections: **Forms** and **Screens**. Each slice gets:
- An `##` heading with the slice name
- Bold metadata lines (Actor + Command for forms; Projection + Query for screens)
- A fenced code block containing the ASCII mockup
- An optional Validation notes block beneath forms (plain text, not in a code block)

Do not include any YAML, JSON, or other structured data in the output — only the Markdown document.

# UI Component Patterns — ASCII Mockup Library

This document defines the canonical ASCII components used when rendering form mockups from Event Model state_change slices, and the rules for mapping EM payload field types to those components.

---

## Field-Type → Component Mapping

| Payload type / heuristic | Component |
|---|---|
| `uuid` (any field named `*Id`) | **Omit** — system-generated; never shown in UI |
| `string` (single line) | Text input |
| `string` with inline comment listing values (e.g. `# Low \| Medium \| High`) | Dropdown or Radio group (≤4 options → radio, >4 → dropdown) |
| `string` with `description`, `notes`, `body`, `comment` in field name | Textarea |
| `boolean` | Checkbox |
| `date` | Date picker |
| `datetime` | Datetime picker |
| `integer` | Number input |
| `decimal` | Number input (decimal) |
| `object` | Fieldset (grouped section with a label) |
| `array<string>` | Tag input |
| `array<T>` (other) | Multi-select list |

### Required fields
Mark a field with `*` when:
- The field has no `# optional` comment in the payload, AND
- It is not a `uuid` field (those are always omitted)

---

## Component ASCII Patterns

### Text input
```
  Label *
  [ placeholder...                      ]
```

### Textarea
```
  Label
  ┌──────────────────────────────────────┐
  │                                      │
  │                                      │
  └──────────────────────────────────────┘
```

### Dropdown (>4 enumerated options, or unknown set)
```
  Label *
  [ Select...                          ▼ ]
```

### Radio group (2–4 known options)
```
  Label *
  ( ) Option A   ( ) Option B   (•) Default
```

### Checkbox
```
  [ ] Label
```

### Date picker
```
  Label
  [ YYYY-MM-DD                          ]
```

### Datetime picker
```
  Datetime Label
  [ YYYY-MM-DD  HH:MM                   ]
```

### Number input
```
  Label *
  [ 0                                   ]
```

### Fieldset (object type)
```
  ┌── Label ─────────────────────────────┐
  │  Sub-field *                         │
  │  [ placeholder...                 ]  │
  │                                      │
  │  Sub-field 2                         │
  │  [ placeholder...                 ]  │
  └──────────────────────────────────────┘
```

### Tag input (array<string>)
```
  Label
  [ tag-one × ] [ tag-two × ] [ + Add   ]
```

### Multi-select list (array<T>)
```
  Label
  [ ] Item A
  [ ] Item B
  [ ] Item C
```

---

## Full Form Shell

Wrap all components inside this shell. The title is derived from the command name split into Title Case words.

```
╔══════════════════════════════════════════╗
║  <Form Title>                            ║
║  Actor: <ActorName>                      ║
╠══════════════════════════════════════════╣
║                                          ║
║  <field components here>                 ║
║                                          ║
╠══════════════════════════════════════════╣
║              [ Cancel ]  [ <Submit> ]    ║
╚══════════════════════════════════════════╝
```

- **Form Title**: command name split on PascalCase into words (e.g. `CreateTodo` → `Create Todo`)
- **Actor**: the `actor` field of the slice
- **Submit button label**: same as Form Title (e.g. `[ Create Todo ]`)
- **Cancel button**: always present

---

## Business Rule Annotations

If `business_rules` are present on the slice, append a _Validation notes_ block beneath the form:

```
  Validation notes:
  • <rule 1>
  • <rule 2>
```

---

## Precondition Context Banner

If the slice has a `precondition`, render a read-only banner above the first field showing what the actor must have selected first:

```
  ┄ Viewing: <projection name> (<query name>) ┄
```

---

## Rendering Order

Render fields in the order they appear in the `command.payload`. Apply these overrides:
1. Skip all `uuid` fields
2. `object` fields → render as a Fieldset
3. `boolean` fields → render as a Checkbox, placed last among fields (before buttons)
4. Fields with inline enum comments → infer options from the comment; use Radio if ≤4 options, Dropdown if >4

---

## State View Patterns

Use these patterns for `state_view` slices. These are read-only screens — no submit button.

---

### Screen Shell

Wrap all state view content inside this shell. The title is the slice `name`. The query line shows the query driving the projection.

```
╔══════════════════════════════════════════╗
║  <Screen Title>                          ║
║  Query: <QueryName>                      ║
╠══════════════════════════════════════════╣
║  <filter bar row — only if filters>      ║
╠══════════════════════════════════════════╣
║                                          ║
║  <content area>                          ║
║                                          ║
╚══════════════════════════════════════════╝
```

Omit the filter bar row and its `╠╣` divider entirely when the slice has no `filters`.

---

### Filter Bar

Render one control per filter entry. Use a dropdown pill for `by <field>` filters; use a sort pill with arrow for `by <field> (ascending/descending)` filters. Show all filters inline, wrapping to a second line if needed.

```
  [ Status: All ▼ ]  [ Priority: All ▼ ]  [ Sort: Date ↑ ]
```

Arrow conventions: ascending → `↑`, descending → `↓`.

---

### List Table

Use for `ListScreen` and `HistoryScreen` types. Derive 3–4 column names from the `source_events` and slice `name`. Show 2–3 placeholder data rows followed by a `…` row.

```
  ┌──────────────────┬──────────────┬────────────┐
  │ Column A         │ Column B     │ Column C   │
  ├──────────────────┼──────────────┼────────────┤
  │ Placeholder...   │ Value        │ 2025-01-01 │
  │ Placeholder...   │ Value        │ 2025-01-10 │
  │ …                │ …            │ …          │
  └──────────────────┴──────────────┴────────────┘
```

For `HistoryScreen`, make the first column a timestamp (`Sent At`, `Occurred At`, etc.).

---

### Detail Card

Use for `DetailScreen` types. Derive field labels from the `source_events` and slice `name`. Show all meaningful fields as aligned key-value pairs.

```
  ┌──────────────────────────────────────────┐
  │  Title:        <value>                   │
  │  Description:  <value>                   │
  │  Priority:     <value>                   │
  │  Due Date:     <value>                   │
  │  Status:       <value>                   │
  │  Created At:   <value>                   │
  └──────────────────────────────────────────┘
```

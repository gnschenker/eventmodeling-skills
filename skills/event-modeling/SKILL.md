---
name: event-modeling
description: This skill should be used when the user wants to create an Event Model (EM) from a product vision, business requirements, feature description, or specifications. Triggers on phrases like "create an event model", "model this as an event model", "turn this into an EM", "event model for", "build an event model", or when the user describes a business domain and wants it modeled using EventModeling methodology invented by Adam Dymitruk.
version: 1.0.0
---

# Event Modeling Skill

Generate a structured Event Model (EM) in YAML from a product vision or business specification. Apply the four canonical EventModeling patterns to decompose every business process into autonomous, well-defined slices.

## Purpose

Transform unstructured business descriptions into an information-complete Event Model. The model captures all business decisions, the facts they produce, the views humans need, the rules that run automatically, and the translations from external systems — in a single coherent artifact.

## When to Use

Activate this skill when the user:
- Provides a product vision, requirements, or feature description and asks for an Event Model
- Wants to model a business domain using EventModeling
- Asks to identify commands, events, actors, and projections from a specification
- Wants to break a system description down into autonomous slices
- Asks to convert user stories or a feature spec into EM slices

## Process

### Step 1: Understand the Domain

Read the provided specification carefully. Extract:
- **Actors**: Who performs actions? (human roles: `Customer`, `Admin`, `BackOfficeAgent`; or non-human: `Scheduler`, `ExternalSystem`)
- **Business decisions**: What deliberate choices are made, and by whom?
- **Facts that must be remembered**: What happened that the business cares about durably?
- **Information needs**: What does each actor need to see in order to act?
- **Automated rules**: What business logic fires without a human triggering it?
- **External integrations**: What data or events arrive from outside the system boundary?

### Step 2: Classify Each Process into One of Four Patterns

Consult `references/em-patterns.md` for full pattern descriptions. Use these shapes:

| Pattern | Shape | Key signal |
|---|---|---|
| **state_change** | Actor → Command → Event | A human makes a decision |
| **state_view** | Events → Projection → Query → UI | Information is read, nothing changes |
| **automation** | Projection(ToDo) → Automation → Command → Event | System acts without a human |
| **translation** | External Event → Process → Command → Internal Event | Foreign fact becomes internal truth |

### Step 3: Apply Naming Conventions

- **Commands**: Imperative, PascalCase — `PlaceOrder`, `CancelPolicy`, `ConfirmCoverage`
- **Events**: Past tense, PascalCase — `OrderPlaced`, `PolicyCancelled`, `CoverageConfirmed`
- **Projections**: Descriptive noun phrase — `ActiveOrdersProjection`, `PendingPoliciesProjection`
- **Queries**: Interrogative or descriptive — `GetActiveOrders`, `FindPendingPolicies`
- **Actors**: Role names — `Customer`, `UnderwritingAgent`, `Scheduler`
- **Processes**: Descriptive noun phrase — `AddressSyncProcess`, `RiskEvaluationProcess`

### Step 4: Produce the YAML Event Model

Follow the schema in `references/em-output-schema.md`. Group slices by `bounded_context` or `capability` when the model covers multiple domains. Emit one slice per business activity — do not merge unrelated concerns into a single slice.

### Step 5: Validate Before Finalizing

Check every slice against these rules:
- `state_change` must have: `actor`, `command`, `event` — no `external_event`, no `projection_todo`
- `state_view` must have: `source_events`, `projection`, `query`, `ui` — no command, no resulting event
- `automation` must have: `trigger`, `projection_todo`, `automation`, `command`, `event` — no `actor`
- `translation` must have: `external_event`, `process`, `command`, `internal_event`
- All event names in past tense
- All command names in imperative form
- Every slice has a meaningful `name` describing its business purpose

## Output Format

Always output the Event Model as a fenced YAML code block (`\`\`\`yaml`). After the YAML, provide a concise summary organized by slice type:

```
### Slices summary
- State changes (N): <list names>
- State views (N): <list names>
- Automations (N): <list names>
- Translations (N): <list names>
```

Then add a short paragraph noting any assumptions made or ambiguities that should be clarified with domain experts.

# EventModeling — The Four Canonical Patterns

EventModeling (EM) decomposes every business process into one of four patterns. Together, these four patterns cover ~99.9% of all business scenarios. They were defined by Adam Dymitruk and are the foundation of information-complete modeling.

---

## Pattern 1: State Change

**A human decides to change the business state.**

The most intuitive pattern. A user provides input. A command expresses intent. A business event durably records the outcome. Nothing else matters at this level — not the UI, not the API transport. What matters is that a **business decision was made and durably stored**.

### Shape

```
Actor → Command → Business Event
```

### Required fields in YAML

```yaml
type: state_change
actor: <role name>
command:
  name: <ImperativeVerb + Noun>
  payload:
    <field>: <type>
event:
  name: <PastTenseVerb + Noun>
  data:
    <field>: <type>
```

### When to use

- A human user submits a form, clicks a button, or makes a deliberate decision
- An API call from an authenticated user triggers a business action
- A back-office agent performs an operation on behalf of the business

### Example

```yaml
name: "Cancel Policy from Inception"
type: state_change
actor: BackOfficeAgent
command:
  name: CancelPolicyFromInception
  payload:
    policyId: string
event:
  name: PolicyFromInceptionCancelled
  data:
    policyId: string
    cancellationDate: date
```

---

## Pattern 2: State View

**Understanding the present from the past.**

Nothing changes in this pattern. It exists purely to _understand_ the system. Past events are replayed into a projection (read model), and users query it. There is no command, no resulting event, no mutation of state — just a question answered from accumulated truth.

### Shape

```
Past Events → Projection → Query → UI
```

### Required fields in YAML

```yaml
type: state_view
source_events:
  - <EventName>
projection: <ProjectionName>
query: <QueryName>
ui: <UIComponentName>
```

### When to use

- A user needs to see a list, dashboard, detail page, or report
- Read-only access to derived state is needed
- Something must be displayed before a decision can be made (precondition for a state_change)

### Example

```yaml
name: "View Lapsed Policies"
type: state_view
source_events:
  - PolicyLapsed
  - PolicyReinstated
projection: LapsedPoliciesProjection
query: GetLapsedPolicies
ui: LapsedPoliciesDashboard
```

---

## Pattern 3: Automation

**The system acts without a human.**

Structurally similar to state_change, but the actor is not a person. It is a scheduler, a background process, a timer, or a rule engine. The intent still becomes a command. The outcome still becomes a business event. Automation is not "magic" — it is a non-human actor following the same rules as a human actor would.

The automation reads from a **to-do projection**: a read model that surfaces work that needs to be done (e.g., "policies that are pending and past their effective date").

### Shape

```
Projection (To-Do) → Automation → Command → Business Event
```

### Required fields in YAML

```yaml
type: automation
trigger: <description of scheduling or condition>
projection_todo: <ProjectionName>
automation: <AutomationName>
command:
  name: <ImperativeVerb + Noun>
  payload:
    <field>: <type>
event:
  name: <PastTenseVerb + Noun>
  data:
    <field>: <type>
```

### When to use

- A background job, cron job, or scheduled task runs on a timer
- Business rules fire automatically when a condition is met (e.g., a deadline passes)
- A saga or process manager reacts to elapsed time

### Example

```yaml
name: "Auto-Activate Pending Policies at Midnight"
type: automation
trigger: "nightly at midnight"
projection_todo: PendingPoliciesForActivationProjection
automation: PolicyActivationJob
command:
  name: ActivatePolicy
  payload:
    policyId: string
event:
  name: PolicyActivated
  data:
    policyId: string
    activationDate: date
```

---

## Pattern 4: Translation

**Turning foreign facts into internal truth.**

This is the most subtle and one of the most important patterns. External systems speak their own language. The internal system must not mirror it directly. Instead, external events are **interpreted, validated, and translated** into the internal business language.

The distinction is critical: the external event is a **foreign fact**. The internal event is **internal business truth**. EventModeling makes this boundary explicit and safe.

### Shape

```
External Event → Process → Command → Internal Business Event
```

### Required fields in YAML

```yaml
type: translation
external_event:
  name: <ExternalEventName>
  source: <ExternalSystemName>
  payload:
    <field>: <type>
process: <ProcessName>
command:
  name: <ImperativeVerb + Noun>
  payload:
    <field>: <type>
internal_event:
  name: <PastTenseVerb + Noun>
  data:
    <field>: <type>
```

### When to use

- An external system publishes an event that is relevant to the internal domain
- A message from a third-party API, CRM, ERP, or event bus must be consumed
- A webhook, integration event, or CDC (Change Data Capture) event arrives
- A foreign concept must be mapped to internal domain language

### Example

```yaml
name: "Sync Policy Owner Address from CRM"
type: translation
external_event:
  name: PartyAddressUpdated
  source: CRM
  payload:
    partyId: string
process: PolicyOwnerAddressSyncProcess
command:
  name: ChangePolicyOwnerAddress
  payload:
    policyId: string
    newAddress: object
internal_event:
  name: PolicyOwnerAddressChanged
  data:
    policyId: string
    newAddress: object
    changedAt: datetime
```

---

## Pattern Comparison Quick Reference

| Aspect | state_change | state_view | automation | translation |
|---|---|---|---|---|
| Triggered by | Human actor | Query | Timer / system | External event |
| Has command? | Yes | No | Yes | Yes |
| Has internal event? | Yes | No | Yes | Yes |
| Mutates state? | Yes | No | Yes | Yes |
| Reads projection? | Optional | Yes | Yes (to-do) | No |
| Has external event? | No | No | No | Yes |

---

## Information Completeness

An EventModel is **information-complete** when:

1. Every state transition is covered by at least one `state_change` or `automation` slice
2. Every piece of information actors need to act on is covered by a `state_view` slice
3. Every automated business rule is covered by an `automation` slice
4. Every external integration point is covered by a `translation` slice
5. All slices together account for the full business lifecycle — no gaps between them

Slices are connected only through published business events. There is no hidden coupling, no shared mutable state across slice boundaries.

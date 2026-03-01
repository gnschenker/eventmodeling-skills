# EventModel YAML Output Schema

This document defines the canonical YAML schema for Event Model output produced by the event-modeling skill.

---

## Top-Level Structure

```yaml
event_model:
  name: string                    # Human-readable name for the entire model
  description: string             # One sentence describing the business domain
  bounded_contexts:               # Optional grouping — use when model spans multiple domains
    - name: string
      slices: [ <slice> ]
  slices: [ <slice> ]             # Use at top level when no bounded contexts needed
```

Use `bounded_contexts` when the model covers multiple distinct business domains (e.g., "Underwriting", "Policy Administration", "Claims"). For single-domain models, place slices directly under `event_model`.

---

## Slice Schemas by Type

### state_change slice

```yaml
- name: string                    # Short description of the business activity
  type: state_change
  actor: string                   # Role performing the action (e.g., Customer, BackOfficeAgent)
  precondition:                   # Optional: state_view slice the actor sees before acting
    projection: string
    query: string
  command:
    name: string                  # PascalCase imperative verb+noun (e.g., PlaceOrder)
    payload:
      <fieldName>: <type>         # Key fields only; use 'object' for nested structures
  business_rules:                 # Optional: key rules enforced during command handling
    - string
  event:
    name: string                  # PascalCase past-tense verb+noun (e.g., OrderPlaced)
    data:
      <fieldName>: <type>
```

### state_view slice

```yaml
- name: string                    # Short description of what is being viewed
  type: state_view
  source_events:                  # Events this projection subscribes to
    - string
  projection: string              # Name of the projection/read-model (e.g., ActiveOrdersProjection)
  query: string                   # Query name (e.g., GetActiveOrders)
  ui: string                      # UI component or screen (e.g., ActiveOrdersDashboard)
  filters:                        # Optional: how the view can be filtered
    - string
```

### automation slice

```yaml
- name: string                    # Short description of the automated activity
  type: automation
  trigger: string                 # When/how it fires (e.g., "nightly at 00:00 UTC", "when PolicyExpired is received")
  projection_todo: string         # To-do projection the automation reads (e.g., PendingActivationsProjection)
  automation: string              # Name of the automation / job / processor
  command:
    name: string                  # PascalCase imperative verb+noun
    payload:
      <fieldName>: <type>
  business_rules:                 # Optional
    - string
  event:
    name: string                  # PascalCase past-tense verb+noun
    data:
      <fieldName>: <type>
```

### translation slice

```yaml
- name: string                    # Short description of the translation activity
  type: translation
  external_event:
    name: string                  # Name as published by the external system
    source: string                # External system name (e.g., CRM, PaymentGateway, ERPSystem)
    payload:
      <fieldName>: <type>
  process: string                 # Name of the translation process / handler
  relevance_check:                # Optional: conditions that determine whether to act
    - string
  command:
    name: string                  # PascalCase imperative verb+noun
    payload:
      <fieldName>: <type>
  internal_event:
    name: string                  # PascalCase past-tense verb+noun
    data:
      <fieldName>: <type>
```

---

## Common Field Types

Use these type annotations for payload and data fields:

| Type | Meaning |
|---|---|
| `string` | Text value |
| `integer` | Whole number |
| `decimal` | Fractional number (prices, rates) |
| `boolean` | True/false flag |
| `date` | Calendar date (no time) |
| `datetime` | Date with time |
| `uuid` | Identifier |
| `object` | Nested structure (expand if important) |
| `array<T>` | List of type T |

---

## Complete Example

```yaml
event_model:
  name: "Term Life Insurance — Policy Lifecycle"
  description: "Covers the key activities in managing a term life insurance policy from application to cancellation."
  bounded_contexts:
    - name: Underwriting
      slices:
        - name: "Submit Underwriting Decision"
          type: state_change
          actor: UnderwritingAgent
          precondition:
            projection: UnderwritingApplicationProjection
            query: GetApplicationForReview
          command:
            name: SubmitUnderwritingDecision
            payload:
              applicationId: uuid
              decision: string       # Accepted | AcceptedWithConditions | Rejected
              notes: string
          business_rules:
            - "Only agents with UnderwritingRole may submit"
            - "Decision must be one of: Accepted, AcceptedWithConditions, Rejected"
          event:
            name: UnderwritingDecisionSubmitted
            data:
              applicationId: uuid
              decision: string
              decidedBy: string
              decidedAt: datetime

        - name: "View Applications Pending Underwriting"
          type: state_view
          source_events:
            - ApplicationReceived
            - UnderwritingDecisionSubmitted
          projection: PendingUnderwritingApplicationsProjection
          query: GetPendingUnderwritingApplications
          ui: UnderwritingWorklistDashboard
          filters:
            - by risk class
            - by received date

    - name: PolicyAdministration
      slices:
        - name: "Confirm Coverage"
          type: state_change
          actor: CoverageConfirmationAgent
          precondition:
            projection: AwaitingCoverageConfirmationProjection
            query: GetPoliciesAwaitingCoverageConfirmation
          command:
            name: ConfirmCoverage
            payload:
              policyId: uuid
              effectiveDate: date
          business_rules:
            - "Cannot be performed by the same agent who submitted the underwriting decision"
            - "Underwriting decision must be Accepted or AcceptedWithConditions"
          event:
            name: CoverageConfirmed
            data:
              policyId: uuid
              effectiveDate: date
              confirmedBy: string
              confirmedAt: datetime

        - name: "Cancel Policy from Inception"
          type: state_change
          actor: BackOfficeAgent
          command:
            name: CancelPolicyFromInception
            payload:
              policyId: uuid
              reason: string
          event:
            name: PolicyFromInceptionCancelled
            data:
              policyId: uuid
              reason: string
              cancelledAt: datetime

        - name: "View Lapsed Policies"
          type: state_view
          source_events:
            - PolicyLapsed
            - PolicyReinstated
          projection: LapsedPoliciesProjection
          query: GetLapsedPolicies
          ui: LapsedPoliciesDashboard

        - name: "Auto-Activate Pending Policies at Midnight"
          type: automation
          trigger: "nightly at 00:00 UTC"
          projection_todo: PendingPoliciesForActivationProjection
          automation: PolicyActivationJob
          command:
            name: ActivatePolicy
            payload:
              policyId: uuid
          business_rules:
            - "Policy effective date must be today or in the past"
            - "Policy must still be in Pending status"
          event:
            name: PolicyActivated
            data:
              policyId: uuid
              activatedAt: datetime

        - name: "Sync Policy Owner Address from CRM"
          type: translation
          external_event:
            name: PartyAddressUpdated
            source: CRM
            payload:
              partyId: string
              newAddress: object
          process: PolicyOwnerAddressSyncProcess
          relevance_check:
            - "Is this party a policy owner in our system?"
            - "Which policy is associated with this party?"
          command:
            name: ChangePolicyOwnerAddress
            payload:
              policyId: uuid
              newAddress: object
          internal_event:
            name: PolicyOwnerAddressChanged
            data:
              policyId: uuid
              newAddress: object
              changedAt: datetime
```

---

## Formatting Guidelines

- Use 2-space indentation throughout
- Quote string values that contain spaces or special characters
- Leave optional fields out entirely if not applicable — do not include empty keys
- Order slices to reflect the natural business flow (chronological where possible)
- Group related slices within a `bounded_context` before unrelated ones

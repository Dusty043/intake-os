# Workflow State Machine

## Purpose

This document defines the authoritative workflow lifecycle for the Digital Solutions Project Intake OS.

The workflow engine controls intake, evaluation, approvals, packaging, provisioning, distribution, recovery, and archival behavior.

Agents must use this file when building request models, status enums, transition guards, approval logic, provisioning jobs, tests, audit logging, and lifecycle-related UI.

## Core Philosophy

The workflow should prioritize:

- predictability
- recoverability
- auditability
- explicit state transitions
- human review checkpoints

No work should be distributed before required approvals are complete.

---

## Canonical Lifecycle States

| State | Meaning | Owner |
|---|---|---|
| `draft` | Request has been started but not submitted | Request Creator |
| `submitted` | Request is formally submitted and awaiting evaluation | Intake Owner |
| `evaluating` | AI evaluation is running | System Worker |
| `clarification_required` | More information is needed | Request Creator / Intake Owner |
| `intake_review` | Evaluation is complete and awaiting Gate 1 review | Intake Owner |
| `devops_review` | Gate 1 passed and request awaits Gate 2 review | DevOps Lead |
| `approved` | Both approval gates are complete | System / DevOps |
| `provisioning` | Downstream resources are being created | Provisioning Worker |
| `distributed` | Provisioning succeeded and project was handed off | DevOps / Execution Systems |
| `provisioning_failed` | One or more provisioning steps failed | DevOps |
| `archived` | Request or project is closed or retained historically | Admin / Authorized Roles |

---

## State Details

### `draft`

Meaning:

A request has been started but not formally submitted.

Allowed actions:

- edit request
- upload attachments
- save draft
- delete draft
- submit request

Blocked actions:

- AI evaluation
- approvals
- provisioning
- distribution

Owner:

Request Creator

### `submitted`

Meaning:

The request has been formally submitted and is awaiting AI evaluation.

Allowed actions:

- generate evaluation
- cancel request
- request clarification

Blocked actions:

- approvals
- provisioning
- distribution

Owner:

Intake Owner

### `evaluating`

Meaning:

The system is actively generating or regenerating an AI evaluation.

Allowed actions:

- cancel evaluation
- retry evaluation if failed

Blocked actions:

- approvals
- provisioning
- distribution
- edits to locked intake fields

Owner:

System Worker

### `clarification_required`

Meaning:

The request is missing required information or contains ambiguity that prevents progression.

Allowed actions:

- answer clarification questions
- edit request
- resubmit
- override clarification requirement

Blocked actions:

- provisioning
- distribution

Owner:

Request Creator or Intake Owner

### `intake_review`

Meaning:

The AI evaluation is complete and awaiting Approval Gate 1 review.

Allowed actions:

- approve
- reject
- hold
- request clarification
- regenerate evaluation
- manually edit evaluation

Blocked actions:

- provisioning
- distribution

Owner:

Intake Owner

### `devops_review`

Meaning:

The request has passed Intake Review and is awaiting Approval Gate 2.

Allowed actions:

- approve
- reject
- hold
- request changes
- request additional discovery
- regenerate evaluation
- edit distribution configuration

Blocked actions:

- provisioning before approval
- distribution before approval

Owner:

DevOps Lead

### `approved`

Meaning:

Both approval gates are complete and the request is approved for provisioning.

Allowed actions:

- generate distribution package
- validate provisioning
- start provisioning
- archive

Blocked actions:

- modifying locked approval records

Owner:

System and DevOps

### `provisioning`

Meaning:

The system is actively creating downstream resources.

Examples:

- Monday items
- GitHub repositories
- GitHub issues
- project templates
- README files
- labels

Allowed actions:

- retry failed provisioning steps
- cancel remaining provisioning
- manual intervention

Blocked actions:

- new approval actions
- major intake modifications

Owner:

Provisioning Worker

### `distributed`

Meaning:

Provisioning completed successfully and the project has been handed off.

Allowed actions:

- view handoff package
- archive project
- attach downstream references
- add operational notes

Blocked actions:

- reprovision without explicit override

Owner:

DevOps and downstream execution systems

### `provisioning_failed`

Meaning:

One or more provisioning steps failed.

Allowed actions:

- retry failed step
- retry entire provisioning job
- partial recovery
- manual recovery
- archive

Blocked actions:

- duplicate provisioning without validation

Owner:

DevOps

### `archived`

Meaning:

The request or project is closed, canceled, completed, or retained for historical purposes.

Allowed actions:

- view history
- restore if permitted

Blocked actions:

- provisioning
- approvals
- evaluation regeneration

Owner:

System Administrators and authorized roles

---

## Canonical Transitions

| Current State | Action | Next State |
|---|---|---|
| `draft` | `submit` | `submitted` |
| `submitted` | `generate_evaluation` | `evaluating` |
| `submitted` | `request_clarification` | `clarification_required` |
| `submitted` | `cancel_request` | `archived` |
| `evaluating` | `success` | `intake_review` |
| `evaluating` | `clarification_needed` | `clarification_required` |
| `evaluating` | `cancel_evaluation` | `submitted` |
| `evaluating` | `evaluation_failed` | `submitted` |
| `clarification_required` | `resubmit` | `submitted` |
| `intake_review` | `approve` | `devops_review` |
| `intake_review` | `request_clarification` | `clarification_required` |
| `intake_review` | `reject` | `archived` |
| `devops_review` | `approve` | `approved` |
| `devops_review` | `reject` | `archived` |
| `devops_review` | `request_changes` | `intake_review` |
| `approved` | `start_provisioning` | `provisioning` |
| `approved` | `archive` | `archived` |
| `provisioning` | `success` | `distributed` |
| `provisioning` | `failure` | `provisioning_failed` |
| `provisioning` | `cancel_remaining` | `provisioning_failed` |
| `provisioning_failed` | `retry` | `provisioning` |
| `provisioning_failed` | `archive` | `archived` |
| `distributed` | `archive` | `archived` |
| `archived` | `restore` | `draft` |

---

## Unresolved or Policy-Dependent Actions

The following actions are recognized but require explicit implementation policy before they are built. Agents must not invent behavior for these actions without updating this document, tests, and any affected ADRs.

| Action | Mentioned In State | Open Question | Recommended Initial Policy |
|---|---|---|---|
| `hold` | `intake_review`, `devops_review` | Should hold be a distinct state or a status flag? | Implement hold as a field first, not a lifecycle state. |
| `request_changes` | `devops_review` | Should this return to `intake_review` or `clarification_required`? | Route from `devops_review` back to `intake_review`. |
| `request_additional_discovery` | `devops_review` | Should this create a clarification cycle or a separate discovery state? | Route to `clarification_required` unless a separate discovery state is later approved. |
| `override_clarification_requirement` | `clarification_required` | Which roles may override, and what audit note is required? | Require Admin or DevOps Lead and an audit reason. |
| `cancel_remaining_provisioning` | `provisioning` | Does cancellation create `provisioning_failed`, `archived`, or a separate canceled state? | Route to `provisioning_failed` with failure reason `canceled`. |
| `restore` | `archived` | Which states can an archived request restore to? | Require Admin and restore to `draft` unless a more specific restore target is explicitly approved. |
| `reprovision_override` | `distributed` | Who can authorize reprovisioning, and how are duplicate resources prevented? | Require explicit DevOps Lead or Admin override and idempotency validation before reprovisioning. |

---

## Workflow Invariants

### Approval Invariants

- Gate 2 cannot occur before Gate 1.
- Distribution cannot occur without both approvals.
- Approval records are immutable after completion.
- Rejected requests cannot provision.
- Archived requests cannot be approved without restoration.

### Provisioning Invariants

- Provisioning must be idempotent.
- External resource IDs must be stored.
- Provisioning retries must not create duplicates.
- Partial provisioning states must be recoverable.
- Failed provisioning must remain inspectable.

### Audit Invariants

- All approval actions must be logged.
- All provisioning actions must be logged.
- Evaluation versions must be preserved.
- State transitions must be timestamped.
- Manual overrides must include actor, timestamp, reason, and previous state.

---

## Required Tests

State machine implementation must include tests for:

- valid transitions
- invalid transitions
- Gate 2 blocked before Gate 1
- provisioning blocked before both approvals
- rejected requests blocked from provisioning
- archived requests blocked from approval and provisioning
- provisioning retry does not create duplicate external resources
- every transition writes an audit event
- approval records cannot be mutated after completion

---

## Implementation Notes for Agents

Before modifying lifecycle behavior, agents must read this file and update affected tests. This applies to:

- request status enums
- approval logic
- provisioning guards
- state transition functions
- lifecycle-related UI
- audit logging

Any product-level change to lifecycle states, transition rules, approval gates, or workflow invariants must be recorded in an ADR or task log with rationale and review notes.

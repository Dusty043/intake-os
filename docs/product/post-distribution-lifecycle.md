# Post-Distribution Lifecycle

## Purpose

This document defines what the Digital Solutions Project Intake OS tracks after approved work has been distributed to Monday and/or GitHub.

The system intentionally avoids deep bidirectional synchronization.

However, it should retain lightweight downstream lifecycle awareness so internal users can understand whether distributed work is active, blocked, completed, canceled, or archived.

---

## Core Philosophy

The custom app remains the pre-distribution control plane.

After distribution, Monday and GitHub become the execution destinations.

The app should track enough lifecycle information to preserve operational visibility without duplicating every downstream execution detail.

The app should not become a full mirror of Monday or GitHub.

---

## Recommended Lifecycle Statuses

| Status | Meaning |
|---|---|
| `distributed` | Provisioning completed and downstream work was handed off |
| `in_progress` | Execution has started downstream |
| `blocked` | Execution is blocked downstream or operationally |
| `completed` | Delivery has been completed |
| `archived` | Project is closed and retained historically |
| `canceled` | Work was canceled after distribution or before completion |

---

## Suggested Lifecycle Transitions

| Current Status | Action | Next Status |
|---|---|---|
| `distributed` | `mark_started` | `in_progress` |
| `distributed` | `mark_blocked` | `blocked` |
| `distributed` | `mark_canceled` | `canceled` |
| `distributed` | `archive` | `archived` |
| `in_progress` | `mark_blocked` | `blocked` |
| `in_progress` | `mark_completed` | `completed` |
| `in_progress` | `mark_canceled` | `canceled` |
| `blocked` | `unblock` | `in_progress` |
| `blocked` | `mark_completed` | `completed` |
| `blocked` | `mark_canceled` | `canceled` |
| `completed` | `archive` | `archived` |
| `canceled` | `archive` | `archived` |

---

## What the App Should Track

The app may track:

- high-level lifecycle status
- downstream start signal
- blocked status
- blocked reason
- completion status
- completion timestamp
- cancellation status
- cancellation reason
- archive timestamp
- downstream reference links
- operational notes
- assigned owner or team
- last manually recorded update

---

## What the App Should Not Track

The app should not continuously mirror:

- every GitHub issue status
- every GitHub pull request
- every GitHub commit
- every Monday field
- every Monday comment
- every assignee change
- every downstream subtask update
- developer activity streams
- low-level execution history

The app should avoid duplicating downstream systems of record.

Monday and GitHub own detailed execution state after distribution.

---

## Downstream References

The app should store links to downstream resources created during provisioning.

Examples:

| Resource | Stored Reference |
|---|---|
| Monday project | board ID, item ID, URL |
| Monday epic | board ID, item ID, parent project ID, URL |
| Monday story/subtask | item ID or subitem ID, parent ID, URL |
| GitHub repo | org, repo name, repo ID, URL |
| GitHub issue | repo, issue number, issue ID, URL |
| GitHub milestone | repo, milestone ID, URL |

These links allow users to navigate to the execution systems without requiring full synchronization.

---

## Lifecycle Update Sources

Lifecycle status may be updated by:

- DevOps Lead
- Admin
- authorized Intake Owner, where appropriate
- system worker, if lightweight integration signals are implemented
- manual admin correction

Initial implementation should prefer manual or explicit lifecycle updates over deep automated sync.

If automated updates are added later, they should remain high-level and auditable.

---

## Lightweight Automated Signals

The system may eventually support lightweight signals from downstream systems.

Examples:

- GitHub repo exists
- GitHub issue count created
- GitHub milestone closed
- Monday project item marked complete
- Monday project item marked blocked
- downstream resource deleted or inaccessible

These signals should update high-level lifecycle state only.

They should not create a full bidirectional sync layer.

---

## Completion Metadata

When a project is marked completed, the system should record:

- completed timestamp
- completing actor or source
- completion note
- final downstream references
- known unresolved follow-ups, if any
- final delivery summary, if provided

Completion should not erase the original intake, evaluation, approvals, distribution package, or provisioning history.

---

## Blocked Metadata

When a project is marked blocked, the system should record:

- blocked timestamp
- blocking actor or source
- blocked reason
- affected downstream resource, if applicable
- owner responsible for resolution
- next recommended action

---

## Cancellation Metadata

When a project is canceled, the system should record:

- canceled timestamp
- canceling actor
- cancellation reason
- whether downstream work already exists
- whether downstream resources should remain, be archived, or be manually closed
- final operational note

Cancellation after distribution should not automatically delete downstream resources.

---

## Archive Behavior

Archiving means the project is closed or retained historically.

Archived records should remain viewable to authorized users.

Archiving should preserve:

- intake request
- AI evaluations
- approval records
- distribution package
- provisioning history
- downstream references
- lifecycle notes
- audit history

Archived projects should not allow normal lifecycle updates unless restored or explicitly overridden.

---

## Reporting Expectations

The app should support lightweight reporting on distributed work.

Useful views:

- distributed projects
- in-progress projects
- blocked projects
- completed projects
- canceled projects
- archived projects
- projects by owner
- projects by downstream destination
- projects with provisioning failures
- projects missing downstream references

Reporting should use the app's high-level lifecycle records, not detailed downstream issue sync.

---

## Lifecycle Audit Rules

The system must audit:

- lifecycle status changes
- blocked status changes
- completion updates
- cancellation updates
- archive actions
- manual lifecycle corrections
- downstream reference edits
- automated lifecycle signal processing, if implemented

Audit records should include:

- actor or system worker
- timestamp
- request ID
- project ID
- previous lifecycle status
- new lifecycle status
- reason or note
- downstream reference, if applicable

---

## Implementation Expectations

Post-distribution lifecycle tracking should be implemented as a lightweight project status layer.

Recommended implementation pieces:

- project lifecycle status enum
- lifecycle status transition helper
- downstream reference model
- lifecycle note model
- blocked reason field
- completion metadata fields
- cancellation metadata fields
- archive metadata fields
- lifecycle audit logger
- distributed project dashboard
- downstream links component

Avoid building deep sync workers unless explicitly approved later.

---

## Required Tests

Post-distribution lifecycle implementation must include tests for:

- distributed project can be marked in progress
- distributed project can be marked blocked
- blocked project can be unblocked
- in-progress project can be marked completed
- distributed or in-progress project can be canceled
- completed project can be archived
- archived project blocks normal lifecycle updates
- downstream references are preserved after completion
- cancellation does not delete downstream resources automatically
- lifecycle status changes create audit records
- unauthorized users cannot change lifecycle status
- reporting filters by lifecycle status
- manual downstream reference edits are audited

---

## Open Questions

| ID | Question | Owner | Status | Notes |
|---|---|---|---|---|
| Q-LIFE-001 | Who can mark a distributed project completed? | DevOps/Admin | resolved | Decision 2026-07-01 (= Q-LIFE-001 in `docs/ai/OPEN_QUESTIONS.md`): DevOps Lead only. |
| Q-LIFE-002 | Should Monday completion status update the app automatically? | DevOps/Admin | open | Avoid deep sync in v1 unless lightweight signal is easy |
| Q-LIFE-003 | Should GitHub milestone closure update lifecycle status? | DevOps/Admin | open | Useful later but not required for v1 |
| Q-LIFE-004 | What lifecycle statuses should appear in management reports? | Management/DevOps | open | Initial statuses listed above |
| Q-LIFE-005 | Should canceled downstream work be closed automatically in Monday/GitHub? | DevOps/Admin | open | Safer to avoid automatic deletion/closure in v1 |

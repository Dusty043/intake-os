# Permissions and Ownership

## Purpose

This document defines the canonical roles, permission rules, ownership transitions, and authority boundaries for the Digital Solutions Project Intake OS.

The system must enforce who can create, edit, review, approve, provision, retry, audit, and administer intake requests and downstream project distribution.

Permissions should protect the approval workflow and prevent unauthorized distribution.

---

## Canonical Roles

| Role | Description |
|---|---|
| Request Creator | Creates and updates intake requests |
| Intake Owner | Reviews and approves intake evaluations |
| DevOps Lead | Approves execution readiness and provisioning |
| Developer | Consumes distributed work packages |
| Admin | Manages system configuration and governance |

---

## Permission Matrix

| Action | Request Creator | Intake Owner | DevOps Lead | Developer | Admin |
|---|---:|---:|---:|---:|---:|
| Create Request | Yes | Yes | Yes | No | Yes |
| Edit Draft | Yes | Yes | Yes | No | Yes |
| Submit Request | Yes | Yes | Yes | No | Yes |
| Generate Evaluation | No | Yes | Yes | No | Yes |
| Approve Gate 1 | No | Yes | Yes | No | Yes |
| Approve Gate 2 | No | No | Yes | No | Yes |
| Trigger Provisioning | No | No | Yes | No | Yes |
| Retry Provisioning | No | No | Yes | No | Yes |
| View Audit Logs | Limited | Limited | Limited | No | Yes |
| Manage Integrations | No | No | No | No | Yes |

---

## Permission Notes

### Request Creator

Request Creators may create, edit, save, and submit their own intake requests.

They should not be able to:

- generate AI evaluations
- approve evaluations
- trigger provisioning
- retry provisioning
- manage integrations
- view full system audit logs

Request Creators may view limited audit history related to their own requests if the product allows it.

### Intake Owner

Intake Owners manage the intake review process and Approval Gate 1.

They may:

- review submitted requests
- generate or regenerate AI evaluations
- request clarification
- approve Gate 1
- reject requests during intake review
- edit evaluation content where permitted
- view limited audit history for assigned requests

They should not be able to approve Gate 2 unless they also hold DevOps or Admin authority.

### DevOps Lead

DevOps Leads manage execution readiness, Approval Gate 2, and provisioning.

They may:

- approve Gate 2
- reject at DevOps review
- request changes
- edit distribution configuration
- trigger provisioning
- retry provisioning
- perform manual provisioning recovery
- view limited audit history for assigned or operationally relevant requests

They should not bypass Gate 1 unless Admin override behavior is explicitly implemented and audited.

### Developer

Developers consume distributed work packages.

They may:

- view assigned downstream implementation work
- use handoff packages
- make implementation decisions within approved scope
- preserve approved goals, constraints, and acceptance criteria

They should not be able to:

- create intake approvals
- trigger provisioning
- change approval records
- manage integrations
- view system-wide audit logs

### Admin

Admins manage system configuration and governance.

They may:

- manage roles
- manage integrations
- view full audit logs
- perform permitted overrides
- restore archived requests where allowed
- manage product configuration
- resolve operational failures

Admin actions that bypass normal workflow rules must be audited.

---

## Ownership Transitions

### Intake Ownership

The Intake Owner controls:

- evaluation review
- clarification routing
- Approval Gate 1
- intake-stage rejection
- intake-stage hold decisions

Ownership begins after a request is submitted.

Ownership transfers to DevOps after Gate 1 approval.

### DevOps Ownership

DevOps controls:

- execution validation
- Approval Gate 2
- distribution configuration
- provisioning approval
- provisioning retry
- manual recovery
- distribution confirmation
- operational routing

Ownership begins after Gate 1 approval.

Ownership transfers operationally after successful distribution.

### Developer Ownership

Developers own implementation after distribution.

Developers control:

- implementation details
- code-level architecture adjustments
- technical delivery
- downstream execution workflow

Developers must preserve:

- approved goals
- approved constraints
- acceptance criteria
- governance boundaries
- security and compliance expectations

---

## Approval Authority

Approval Gate 1 may be completed by:

- Intake Owner
- DevOps Lead, if acting with Intake Owner authority
- Admin

Approval Gate 2 may be completed by:

- DevOps Lead
- Admin

Approval Gate 2 must not occur before Approval Gate 1.

AI must never approve requests.

Approval records become locked after completion and should not be modified casually.

---

## Provisioning Authority

Provisioning may be triggered by:

- DevOps Lead
- Admin

Provisioning retry may be triggered by:

- DevOps Lead
- Admin

Manual provisioning recovery may be performed by:

- DevOps Lead
- Admin

Provisioning must remain blocked unless:

- Gate 1 is complete
- Gate 2 is complete
- the request is in the `approved` state
- distribution package validation has passed

---

## Audit Visibility

Audit visibility should follow least privilege.

| Role | Audit Visibility |
|---|---|
| Request Creator | Limited to own request activity, if enabled |
| Intake Owner | Limited to assigned or intake-stage requests |
| DevOps Lead | Limited to operationally relevant requests and provisioning actions |
| Developer | No audit log access by default |
| Admin | Full audit log access |

The system should avoid exposing unrelated request history to users who do not need it.

---

## Override Rules

Some workflow exceptions may be allowed, but they must be explicit and audited.

Examples of override actions:

- overriding clarification requirement
- restoring archived requests
- reprovisioning a distributed project
- reducing evaluation depth
- changing project type
- changing GitHub requirement
- changing distribution mode
- manually recovering provisioning

Every override must record:

- actor
- role
- timestamp
- request ID
- previous value or state
- new value or state
- reason
- related approval or provisioning record, if applicable

Overrides that reduce governance burden should require Admin authority or explicit DevOps justification.

---

## UI Behavior Expectations

The UI should hide or disable actions that the current user cannot perform.

Examples:

- Request Creators should not see approval buttons.
- Intake Owners should not see Gate 2 approval unless they also have DevOps/Admin authority.
- Developers should not see provisioning controls.
- Admin-only integration settings should not appear for non-admin users.
- Disabled actions should explain the missing permission when useful.

Backend permission checks must still enforce all rules even if the UI hides an action.

---

## Implementation Expectations

Permissions should be implemented with explicit role checks and workflow guard checks.

Recommended implementation pieces:

- user role enum
- permission helper functions
- workflow action guard functions
- ownership assignment fields
- approval authority checks
- provisioning authority checks
- audit visibility filters
- override audit logger
- UI action availability helpers

Do not rely only on frontend visibility for security.

Server-side checks must enforce role and state rules.

---

## Required Tests

Permissions implementation must include tests for:

- Request Creator can create, edit draft, and submit own request
- Request Creator cannot generate evaluation
- Request Creator cannot approve Gate 1 or Gate 2
- Intake Owner can generate evaluation
- Intake Owner can approve Gate 1
- Intake Owner cannot approve Gate 2 unless also DevOps/Admin
- DevOps Lead can approve Gate 2 only after Gate 1
- DevOps Lead can trigger provisioning only after approval
- Developer cannot approve or provision
- Admin can manage integrations
- Admin can view full audit logs
- limited audit views do not expose unrelated requests
- unauthorized API calls are rejected server-side
- override actions require reason and audit record

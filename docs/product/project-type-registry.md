# Project Type Registry

## Purpose

This document defines the canonical project types used by the Digital Solutions Project Intake OS.

Project types drive:

- evaluation depth
- provisioning behavior
- GitHub creation
- Monday distribution mode
- risk classification
- approval routing
- templates and defaults

Project types should be centrally managed and should not be hardcoded casually across the application.

This document should be referenced by the AI classifier, evaluation pipeline, distribution planner, provisioning logic, and admin configuration.

---

## Canonical Project Types

| Project Type | GitHub Required | Default Evaluation Depth | Default Distribution Mode |
|---|---:|---|---|
| n8n Automation | No | Light | C |
| Data Sync / Integration | Optional | Light | C |
| Internal Dashboard | Optional | Standard | B or C |
| Internal Tool | Yes | Standard | B |
| Client Portal | Yes | Full | B |
| SaaS Platform | Yes | Full | B |
| API Service | Yes | Standard or Full | B |
| AI Workflow Tool | Yes | Full | B |
| Discovery / Research | No | Light | None |
| Reporting Automation | Optional | Standard | C |

---

## Recommended Enum Values

Agents and implementation code should use stable enum values rather than inventing new strings.

| Display Name | Enum Value |
|---|---|
| n8n Automation | `n8n_automation` |
| Data Sync / Integration | `data_sync_integration` |
| Internal Dashboard | `internal_dashboard` |
| Internal Tool | `internal_tool` |
| Client Portal | `client_portal` |
| SaaS Platform | `saas_platform` |
| API Service | `api_service` |
| AI Workflow Tool | `ai_workflow_tool` |
| Discovery / Research | `discovery_research` |
| Reporting Automation | `reporting_automation` |

---

## GitHub Requirement Values

GitHub requirement should support three values:

| Value | Meaning |
|---|---|
| `yes` | GitHub repo provisioning is expected by default |
| `no` | GitHub repo provisioning is not expected by default |
| `optional` | GitHub provisioning depends on implementation path |

Optional GitHub projects should be resolved during evaluation and DevOps review.

A project with `optional` GitHub requirement may become GitHub-required if the approved implementation path includes custom code, long-term code ownership, API services, deployment, or engineering collaboration.

---

## Distribution Mode Values

| Mode | Meaning |
|---|---|
| `none` | No downstream distribution by default |
| `B` | Monday receives project and epics; GitHub handles engineering detail |
| `C` | Monday receives project, epics, stories, subtasks, acceptance criteria, and dependencies |
| `B_or_C` | Distribution mode must be selected during evaluation or DevOps review |

Distribution mode rules are defined in:

- `docs/product/distribution-rules.md`

---

## Evaluation Depth Rules

### Light Evaluation

Suitable for:

- simple automations
- lightweight workflows
- operational tasks
- low-risk integrations

Should include:

- summary
- systems involved
- recommended approach
- assumptions
- basic work breakdown

### Standard Evaluation

Suitable for:

- moderate integrations
- dashboards
- internal tooling
- workflow orchestration

Should include:

- architecture sketch
- implementation options
- dependencies
- acceptance criteria
- epics and stories

### Full Evaluation

Suitable for:

- SaaS systems
- client-facing platforms
- sensitive systems
- infrastructure-heavy applications
- high-risk implementations

Should include:

- architecture design
- deployment considerations
- data/security considerations
- trade-off analysis
- cost engineering
- operational concerns
- detailed implementation planning

---

## Classification Rules

The Project Classifier Agent should assign:

- primary project type
- secondary candidate types
- confidence score
- recommended evaluation depth
- GitHub requirement recommendation
- Monday distribution mode recommendation

If confidence is low, the request should be flagged for Intake Owner review.

If multiple project types apply, the classifier should choose the type that implies the higher governance burden.

Examples:

- If a request is both an Internal Dashboard and an AI Workflow Tool, treat it as an AI Workflow Tool unless a human overrides it.
- If a request is both Data Sync / Integration and API Service, treat it as API Service if custom API development is required.
- If a request is Discovery / Research but includes implementation, classify the implementation separately or escalate for review.

---

## Override Rules

Humans may override project type, evaluation depth, GitHub requirement, or distribution mode.

Overrides must record:

- previous value
- new value
- actor
- timestamp
- reason

Overrides that reduce governance burden should require extra care.

Examples of reducing governance burden:

- Full evaluation to Standard or Light
- GitHub Required to Optional or No
- Client Portal to Internal Tool
- Mode B to None

---

## Registry Governance

Project types should be centrally managed.

Agents should not create new project types without explicit instruction.

Adding or changing a project type should require:

- update to this registry
- update to relevant enums or seed data
- update to evaluation routing logic
- update to distribution logic
- update to tests
- ADR if the change affects architecture, approvals, or provisioning behavior

---

## Implementation Expectations

The project type registry should be implemented as either:

- versioned configuration, or
- database-backed admin configuration with seeded defaults

The first implementation may use static typed configuration if it is easy to test and update.

The implementation should expose:

- project type display name
- stable enum value
- GitHub requirement default
- evaluation depth default
- distribution mode default
- optional description
- active/inactive flag

---

## Required Tests

Project type implementation must include tests for:

- every canonical project type exists
- every project type has a stable enum value
- every project type has a default evaluation depth
- every project type has a GitHub requirement value
- every project type has a distribution mode value
- optional GitHub requirement can be resolved during evaluation
- `B_or_C` distribution mode must be resolved before provisioning
- low-confidence classification requires human review
- human overrides are audited
- unknown project types are rejected or flagged for admin review

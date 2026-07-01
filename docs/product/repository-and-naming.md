# Repository and Naming Strategy

## Purpose

This document defines repository provisioning standards, naming conventions, GitHub templates, labels, README generation, and repository initialization expectations for the Digital Solutions Project Intake OS.

GitHub repositories should be created only when the approved project requires custom code, engineering collaboration, long-term code ownership, or deployment workflows.

Repository creation must be controlled, predictable, and auditable.

---

## Repository Naming Philosophy

Repository names should be:

- human-readable
- predictable
- stable
- lowercase
- hyphen-separated
- aligned with organizational naming standards
- specific enough to avoid confusion
- short enough to remain practical

Repository names should avoid:

- excessive abbreviations
- vague names
- client-sensitive details when avoidable
- spaces
- special characters
- duplicate names
- temporary working titles

---

## Canonical Repository Naming Format

Suggested format:

```text
<team>-<project-type>-<project-name>
```

Examples:

```text
ds-internal-intake-os
ops-n8n-client-sync
client-portal-acme
```

Where:

- `team` identifies the owning team or business area
- `project-type` identifies the general class of project
- `project-name` identifies the specific project

---

## Naming Components

### Team Prefix

Examples:

| Prefix | Meaning |
|---|---|
| `ds` | Digital Solutions |
| `ops` | Operations |
| `client` | Client-facing work |
| `internal` | Internal tooling |

The final prefix list should be confirmed by DevOps or Admin configuration.

### Project Type Segment

Recommended project-type segments:

| Project Type | Repo Segment |
|---|---|
| n8n Automation | `n8n` |
| Data Sync / Integration | `integration` |
| Internal Dashboard | `dashboard` |
| Internal Tool | `tool` |
| Client Portal | `portal` |
| SaaS Platform | `saas` |
| API Service | `api` |
| AI Workflow Tool | `ai-workflow` |
| Reporting Automation | `reporting` |

Discovery / Research should not usually create a repository unless implementation is later approved.

---

## Slug Generation Rules

When generating repository names, the system should:

1. convert text to lowercase
2. trim leading and trailing spaces
3. replace spaces and separators with hyphens
4. remove unsupported characters
5. collapse repeated hyphens
6. remove leading or trailing hyphens
7. avoid excessive abbreviation
8. preserve meaningful words
9. validate final name before provisioning

Example:

| Input | Output |
|---|---|
| Digital Solutions | `ds` |
| Internal Tool | `tool` |
| Project Intake OS | `project-intake-os` |
| ACME Client Portal | `acme-client-portal` |

---

## Suggested Repository Name Object

```json
{
  "team_prefix": "ds",
  "project_type_segment": "tool",
  "project_slug": "project-intake-os",
  "proposed_repo_name": "ds-tool-project-intake-os",
  "final_repo_name": "ds-tool-project-intake-os",
  "collision_detected": false,
  "override_reason": null
}
```

---

## Repository Name Validation

Before provisioning, the system must validate that the repository name:

- is not empty
- is lowercase
- uses hyphen-separated words
- does not contain spaces
- does not contain unsupported special characters
- does not collide with an existing repository
- does not exceed configured length limits
- does not include secrets or credentials
- does not include unnecessary sensitive client information

If validation fails, GitHub provisioning must be blocked until the name is corrected.

---

## Collision Handling

Repository provisioning must detect collisions before creating a repo.

Collision examples:

- proposed repo already exists
- repo exists from a prior provisioning attempt
- repo exists but is not linked to the current request
- external GitHub repo ID is already stored for another request

Expected behavior:

- stop repo creation
- show collision reason
- require DevOps or Admin review
- allow authorized user to choose a new name
- allow authorized user to link an existing repo if appropriate
- audit the resolution

The system must not automatically create duplicate repos by adding random suffixes unless this behavior is explicitly approved.

---

## Repository Templates

The system should support reusable repository templates.

Templates may include:

- README structure
- CI/CD defaults
- issue templates
- pull request templates
- labels
- CODEOWNERS
- environment configuration guidance
- directory structure
- sample `.env.example`
- testing setup notes

---

## Template Selection Rules

Repository template should be selected based on:

- project type
- implementation recommendation
- approved stack
- frontend/backend/API needs
- deployment expectations
- DevOps review decision

Examples:

| Project Type | Suggested Template |
|---|---|
| Internal Tool | `internal-tool-template` |
| Client Portal | `client-portal-template` |
| API Service | `api-service-template` |
| AI Workflow Tool | `ai-workflow-template` |
| Reporting Automation | `reporting-automation-template` |

If no template is available, the system should fall back to a minimal repository template.

---

## Initial Labels

Suggested default labels:

- `bug`
- `enhancement`
- `infrastructure`
- `backend`
- `frontend`
- `automation`
- `ai`
- `blocked`
- `needs-review`

Additional labels may be added based on project type.

Examples:

| Project Type | Additional Labels |
|---|---|
| API Service | `api`, `integration`, `security` |
| Client Portal | `frontend`, `auth`, `client-facing` |
| AI Workflow Tool | `ai`, `evaluation`, `prompting` |
| n8n Automation | `automation`, `workflow`, `integration` |

---

## README Generation

Generated READMEs should include:

- project name
- project summary
- approved goal
- approved scope
- architecture overview
- setup instructions
- environment expectations
- local development commands
- testing commands
- deployment notes, if known
- links to intake and distribution records
- links to Monday and GitHub issues, if available
- ownership and handoff notes

---

## Suggested Generated README Structure

````markdown
# [Project Name]

## Summary

[Generated from approved distribution package]

## Approved Goal

[Approved goal from intake/evaluation]

## Scope

### In Scope

-

### Out of Scope

-

## Architecture Overview

-

## Setup

```bash
npm install
```

## Environment

Copy `.env.example` to `.env.local`.

Required variables:

```text
...
```

## Development

```bash
npm run dev
```

## Tests

```bash
npm test
```

## Links

- Intake Record:
- Distribution Record:
- Monday Project:
- GitHub Issues:

## Ownership

- Request Owner:
- DevOps Owner:
- Developer Owner:
````

---

## Issue Templates

Provisioned repositories should include issue templates where appropriate.

Suggested templates:

- feature request
- bug report
- engineering task
- infrastructure task
- integration task
- AI workflow task

Issue templates should encourage agents and developers to include:

- task ID
- context
- acceptance criteria
- dependencies
- test expectations
- links to intake/distribution records

---

## Pull Request Template

Provisioned repositories should include a pull request template.

Suggested fields:

- task ID
- summary
- files changed
- tests run
- screenshots, if UI changed
- risks
- follow-ups
- AI memory updated, if applicable
- linked issue

---

## CODEOWNERS

Repositories should support CODEOWNERS when ownership is known.

CODEOWNERS may include:

- DevOps owner
- engineering owner
- project team
- security reviewer, if needed

If ownership is not yet known, CODEOWNERS may be deferred but should be listed as a follow-up.

---

## Environment Configuration Guidance

Generated repositories should include `.env.example` when environment variables are expected.

Rules:

- never commit real secrets
- include placeholder values only
- document required variables
- document optional variables
- note which values are local-only
- note which values are managed by deployment infrastructure

The generated README should explain how to copy and use the example env file.

---

## Repository Provisioning Audit Rules

The system must audit:

- proposed repo name generation
- manual repo name edits
- repo name validation
- collision detection
- template selection
- repository creation
- label creation
- README creation
- issue template creation
- CODEOWNERS creation
- provisioning failure
- manual recovery or linked existing repo

Audit records should include:

- actor or system worker
- timestamp
- request ID
- distribution package ID
- proposed repo name
- final repo name
- GitHub org
- GitHub repo ID, if created
- GitHub repo URL, if created

---

## Implementation Expectations

Repository naming and provisioning should be implemented through explicit services, not scattered string construction.

Recommended implementation pieces:

- repository naming service
- slug generation helper
- repo name validator
- collision checker
- template registry
- README generator
- label generator
- issue template generator
- CODEOWNERS generator
- GitHub provisioning service
- external resource reference model
- audit logger

Repository provisioning should operate from a frozen distribution package, not mutable intake fields.

---

## Required Tests

Repository and naming implementation must include tests for:

- repo names are generated from team, project type, and project name
- generated repo names are lowercase
- generated repo names are hyphen-separated
- unsupported characters are removed
- repeated hyphens are collapsed
- empty repo names are rejected
- duplicate repo names are detected before provisioning
- collisions block automatic provisioning
- manual repo name override requires audit reason
- GitHub repo is created only when approved distribution requires it
- default labels are generated
- project-type-specific labels are generated when configured
- README includes approved goal
- README includes architecture overview
- README includes setup instructions
- README includes links to intake/distribution records
- `.env.example` does not contain real secrets
- repository external ID and URL are stored after creation

---

## Open Questions

| ID | Question | Owner | Status | Notes |
|---|---|---|---|---|
| Q-REPO-001 | What are the approved team prefixes? | DevOps/Admin | resolved | Decision 2026-07-01 (= Q-0002 in `docs/ai/OPEN_QUESTIONS.md`): keep `ds`, `ops`, `client`, `internal` — no change. |
| Q-REPO-002 | Which GitHub org should repos be created under? | DevOps/Admin | tentative | Decision 2026-07-01 (= Q-0003): `Simple-biz`, but unverified — picked from guessed quick-pick options, not typed by an admin. Confirm the exact org handle before first live provisioning. |
| Q-REPO-003 | Should repos be private by default? | DevOps/Admin | resolved | Decision 2026-07-01 (= Q-0004): yes, private by default. |
| Q-REPO-004 | Which branch protection rules should be applied by default? | DevOps/Admin | open | Could be deferred from v1 |
| Q-REPO-005 | Which repo templates exist at launch? | DevOps/Admin | open | Needed for template registry |

# Distribution Rules

## Principle

The Project Intake OS is the pre-distribution source of truth. Monday and GitHub are downstream execution destinations.

Distribution happens only after:

1. Intake is reviewed.
2. Required approval gates are complete.
3. Distribution preview is generated.
4. A human approves downstream creation.

AI-generated content alone must never trigger live downstream writes.

## What Stays in the OS

- raw or normalized intake source data, subject to retention policy
- AI analysis drafts and versions
- human-edited approved brief
- approval history
- audit trail
- distribution preview
- external resource IDs and URLs
- idempotency keys
- compliance flags
- assignment recommendation history

## What Goes to Monday

Monday should receive management-visible delivery tracking:

- project title
- approved brief summary
- project type
- requester/client/internal owner
- priority/status
- story point estimate or complexity bucket
- assigned developer/owner if available
- subtasks or subitems when mapping is confirmed
- link back to Project Intake OS record
- GitHub repo link after repo creation

Do not mirror every OS field into Monday.

## Monday Downstream Target — Dev Operations Workspace

The live Monday target is the **Dev Operations Workspace** (six linked boards). The provisioning manifest must generate items that map to this structure. Schema confirmed against `Dev-Operations-Manager-Guide.pdf` (Simple.biz AI & Automation Team, prepared by Cob) — see Q-0005 resolution in `docs/ai/OPEN_QUESTIONS.md`.

Boards 1 (Team Directory) and 5 (Credentials Vault) are populated by PM/admin, not by the intake OS — listed below for completeness but the OS does not write to them at provisioning time.

### Board 1: Team Directory (reference only, not written by the OS)
One row per person. Groups: Fullstack Developers, Integration Specialists. Used to resolve `assigned developer` against a real roster entry, not to create rows.

### Board 2: Projects Portfolio
One row per whole deliverable. The intake OS creates this when `recommendedAction = create_project`.

| Field | Source |
|---|---|
| Name | proposal title |
| Client | intake client field (null = internal) |
| Project Type (group) | intent type → `MondayProjectType` (`src/domain/discovery.ts`): Web App, Chrome Extension, n8n Workflow, Dashboard, CRM, SaaS, Process Change, Other. Live board may carry additional groups beyond the 6 named in the source guide ("and more") — confirm against the live board before adding new intent→type mappings. |
| Project Lead | assigned developer (null until roster match confirmed) |
| Status | "Conceptualization" on creation |
| Health | "green" on creation |
| Tech Stack | derived from system design slot |
| Target Launch | not populated at intake — set by PM |
| Estimated Total SP | sum of epic SPs (bottom-up, not top-down guess) |

### Board 3: Roadmap & Epics
One row per large chunk of the project. Epics are grouped by quarter (Q1–Q4).

| Field | Source |
|---|---|
| Title | suggestedEpics from proposal |
| Quarter | planning quarter (next quarter from generation date) |
| Estimated SP | per epic: 8 SP (design), 13 SP (core), 8 SP (testing), 5 SP thereafter |
| Status | "Not Started" on creation |
| Owner | null until assigned |

### Board 4: Sprint Tasks
One row per concrete piece of work. Tasks go to **Backlog** on creation.

| Field | Source |
|---|---|
| Title | suggestedTasks from proposal |
| Type | "Feature" by default |
| Epic | linked to first epic |
| Estimated SP | 3 SP default (refined in sprint planning) |
| Sprint Group | "Backlog" on creation |
| Priority | "Medium" by default |
| GitHub Link | populated after GitHub issue is created |

### Board 5: Credentials Vault
Populated manually by PM after provisioning. The intake OS may suggest credentials needed (e.g. API keys detected in tech stack) but does not write to this board automatically.

### Board 6: Microtasks & Ops
Used when `recommendedAction = create_microtask` or `create_task`. Goes to "This Week" by default.

## What Goes to GitHub

GitHub should receive engineering execution assets:

- repository if required
- README/project brief (generated from proposal: title, problem statement, requirements, tech stack, epics, assumptions, open questions)
- labels (derived from intent type)
- initial issues (one per suggested task, with labels)
- link back to Project Intake OS record
- Monday project/item link if created

### README Template Structure

```markdown
# {Project Title}
> {problem statement}

## Key Requirements
- functional requirement 1
- functional requirement 2

## Tech Stack
- API layer
- Client layer
- Infrastructure

## Architecture
{monolith/microservices} — {rationale}

## Epics
- Epic: Requirements & Design
- Epic: Core Implementation
- Epic: Testing & QA

## Assumptions
- assumption 1

## Open Questions
- unknown 1

## Links
- Project Intake OS record: {url}
```

## Distribution Modes

| Mode | Meaning |
| --- | --- |
| none | No downstream creation. Keep in OS only. |
| monday_only | Create Monday tracking item/subitems only. |
| github_only | Create GitHub repo/issues only. |
| monday_and_github | Create both Monday and GitHub assets. |
| preview_only | Generate preview but block live execution. |

## Idempotency Rules

Every downstream action must have an idempotency key.

Examples:

- `intake:{id}:github:repo:{repoName}`
- `intake:{id}:github:issue:{slug}`
- `intake:{id}:monday:item:{boardId}:{itemName}`

Retry behavior:

- If an external resource exists and is recorded, reuse it.
- If Monday succeeds and GitHub fails, retry GitHub only.
- If GitHub succeeds and Monday fails, retry Monday only.
- Never create duplicate repos, items, or issues on retry.

## Failure Rules

- Partial failures must create audit events.
- Failed steps should be visible in the OS.
- Users should be able to retry failed steps after reviewing the preview and existing external resources.
- Automatic deletion of downstream resources should be avoided in v1.

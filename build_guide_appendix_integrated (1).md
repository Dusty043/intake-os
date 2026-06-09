# **Build Guide for Codex and Claude Code**

## **Digital Solutions Project Intake OS**

## **Purpose of This Guide**

This guide explains how to build the **Digital Solutions Project Intake OS** using AI coding agents such as **Codex** and **Claude Code**, while requiring every agent session to produce structured Markdown logs for indexing, review, and memory.

The goal is to make AI-assisted development traceable.

Every meaningful agent action should leave behind a written record:

```
what was requested
what the agent planned
what it changed
what commands it ran
what tests passed or failed
what decisions were made
what still needs human review
```

The build process should not depend on memory inside Codex or Claude Code alone. The repository itself should contain the durable memory.

## **Revision Note — Appendix Integration**

This updated version incorporates the appendix specifications as implementation requirements for the build protocol. The appendices are now treated as product contracts for:

* workflow lifecycle states, transitions, approval gates, retry behavior, and audit invariants  
* multi-agent AI evaluation orchestration  
* project type classification and evaluation-depth routing  
* Monday/GitHub distribution rules  
* permission and ownership rules  
* failure recovery and dead-letter handling  
* AI cost governance  
* repository naming and provisioning standards  
* lightweight post-distribution lifecycle tracking

Agents should not treat the appendices as optional reference material. They should be converted into code, tests, prompts, schemas, documentation, and review checklists as the relevant build phase is reached.

---

# **1\. Core Principle**

## **1.1 Agent Memory Must Live in the Repo**

AI coding tools can have their own session memory, context files, and conversation history, but the project should not depend on any single tool's internal memory.

The repo should contain the durable project memory.

```
Agent session memory = temporary
Repository Markdown memory = durable
```

Therefore, every agent must read from and write to shared Markdown memory files.

---

## **1.2 Use Agents as Builders, Not Owners**

Codex and Claude Code should help implement the project, but they should not own architectural authority.

The agents may:

* inspect the repo  
* propose implementation plans  
* write code  
* update tests  
* update documentation  
* generate migration files  
* prepare PRs  
* append build logs  
* summarize completed work

The agents may not:

* skip logging  
* bypass tests  
* delete memory files  
* overwrite approval/history files without instruction  
* make unreviewed production decisions  
* commit secrets  
* change architecture without recording the decision

---

## **1.3 Every Task Produces a Trace**

Every agent task should produce:

```
1. task log
2. build log entry
3. memory update, if needed
4. decision record, if architecture changed
5. handoff note
```

The log is not optional.

---

## **1.4 Appendix-Derived Implementation Contracts**

The appendices define the behavior the app must implement. Coding agents must use them as acceptance criteria, not as background notes.

### **Workflow Contract**

The request lifecycle must be implemented as a deterministic state machine with these canonical states:

```
draft
submitted
evaluating
clarification_required
intake_review
devops_review
approved
provisioning
distributed
provisioning_failed
archived
```

The initial valid transitions are:

| Current State | Action | Next State |
| :---- | :---- | :---- |
| draft | submit | submitted |
| submitted | generate evaluation | evaluating |
| evaluating | success | intake\_review |
| evaluating | clarification needed | clarification\_required |
| clarification\_required | resubmit | submitted |
| intake\_review | approve | devops\_review |
| intake\_review | clarification | clarification\_required |
| intake\_review | reject | archived |
| devops\_review | approve | approved |
| devops\_review | reject | archived |
| approved | start provisioning | provisioning |
| provisioning | success | distributed |
| provisioning | failure | provisioning\_failed |
| provisioning\_failed | retry | provisioning |
| distributed | archive | archived |

State-machine implementation must enforce these invariants:

* Gate 2 cannot occur before Gate 1\.  
* Distribution cannot occur without both approvals.  
* Approval records are immutable after completion.  
* Rejected requests cannot provision.  
* Provisioning must be idempotent.  
* External resource IDs must be stored.  
* Retries must not create duplicate downstream resources.  
* Evaluation versions, approval actions, provisioning actions, and state transitions must be logged.

### **AI Evaluation Contract**

The AI system should be implemented as a staged multi-agent pipeline, not as one monolithic prompt.

Required agent roles:

| Agent | Primary Responsibility |
| :---- | :---- |
| Intake Analyst | Normalize the raw request into a project brief |
| Clarification | Identify missing, ambiguous, risky, or underspecified information |
| Project Classifier | Select project type, evaluation depth, risk level, and distribution path |
| Solutions Architect | Recommend architecture and technical approach |
| No-Code / Low-Code | Evaluate n8n, Monday, SaaS, scripts, and lightweight automation paths |
| Custom Build | Evaluate the custom engineering path |
| Risk and Security | Identify technical, operational, privacy, credential, and delivery risks |
| Cost and Effort | Estimate effort, AI cost, infrastructure cost, and maintenance burden |
| Work Breakdown | Generate epics, stories, issues, acceptance criteria, dependencies, and sequencing |
| Distribution Planner | Decide Monday/GitHub packaging and provisioning requirements |
| Final Synthesis | Merge outputs into a human-readable evaluation packet |
| Critic / QA | Check completeness, contradictions, unsupported assumptions, and readiness |

The pipeline should run in these stages:

1. Intake normalization  
2. Parallel evaluation  
3. Recommendation and work breakdown  
4. Quality review  
5. Human review

AI may draft evaluations, issues, and handoff materials. AI may not approve projects.

### **Project Type Registry Contract**

The app must centralize project type rules because project type drives evaluation depth, GitHub provisioning, Monday distribution mode, risk classification, and templates.

| Project Type | GitHub Required | Default Evaluation Depth | Default Distribution Mode |
| :---- | ----: | :---- | :---- |
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

### **Distribution Contract**

Monday and GitHub are execution destinations, not the system of record for intake, evaluation, approvals, or provisioning history.

Use Monday Mode B when GitHub exists and engineering execution primarily occurs in GitHub. Monday receives project summary, epics, ownership, operational metadata, and GitHub links.

Use Monday Mode C when GitHub is unnecessary and execution is operational or low/no-code. Monday receives project, epics, stories, subtasks, acceptance criteria, and dependencies.

GitHub should only be provisioned when custom code, repository ownership, engineering collaboration, or long-term code maintenance is expected.

### **Permissions and Ownership Contract**

The app must distinguish these canonical roles:

* Request Creator  
* Intake Owner  
* DevOps Lead  
* Developer  
* Admin

Ownership moves from request creator to intake owner during evaluation and Gate 1, then to DevOps after Gate 1 approval, then operationally to downstream execution systems after distribution.

### **Failure and Recovery Contract**

The system must favor recoverability, retryability, observability, and partial success handling. Provisioning and integration jobs must support:

* transient API retry  
* exponential backoff for rate limits  
* manual correction for validation failures  
* manual intervention for collisions  
* re-authentication for authentication failures  
* dead-letter handling for repeated failures  
* payload preservation and replay support

### **Cost Governance Contract**

AI usage must be measurable and governable. Track model usage, token usage, regeneration count, estimated evaluation cost, monthly spend, and agent-level cost.

Use lower-cost models for summarization, classification, clarification, and metadata extraction. Reserve higher-capability models for architecture, synthesis, trade-off analysis, complex evaluations, and QA.

### **Repository and Naming Contract**

Provisioned repositories should follow this pattern unless overridden by an approved organization standard:

```
<team>-<project-type>-<project-name>
```

Generated repositories should include README content, labels, issue templates, pull request templates, CODEOWNERS where appropriate, and environment configuration guidance.

### **Post-Distribution Lifecycle Contract**

The app should avoid deep bidirectional synchronization after handoff. It may track high-level lifecycle signals only:

```
distributed
in_progress
blocked
completed
archived
canceled
```

The app should retain high-level operational state, closure metadata, completion timestamps, and downstream links without mirroring every GitHub issue, pull request, Monday field, or developer activity event.

# **2\. Recommended Repository Structure**

Use this structure for the app repository.

```
project-intake-os/
  AGENTS.md
  CLAUDE.md
  README.md
  package.json
  .env.example

  app/
  src/
  prisma/
  tests/
  scripts/

  docs/
    ai/
      README.md
      BUILD_LOG.md
      MEMORY_INDEX.md
      PROJECT_MEMORY.md
      OPEN_QUESTIONS.md
      KNOWN_CONSTRAINTS.md
      DECISIONS_SUMMARY.md
      TASK_TEMPLATE.md
      HANDOFF_TEMPLATE.md

      tasks/
        0000-example-task.md

      decisions/
        ADR-0001-use-modular-monolith.md

      prompts/
        codex-task-template.md
        claude-task-template.md
        review-template.md
        bugfix-template.md

      daily/
        2026-05-15.md
```

Appendix-integrated builds should also create a product-spec mirror under `docs/product/` so agents can read stable, focused references without parsing one large appendix file every session.

Recommended addition:

```
  docs/
    product/
      README.md
      workflow-state-machine.md
      ai-orchestration.md
      project-type-registry.md
      distribution-rules.md
      permissions-and-ownership.md
      failure-and-recovery.md
      ai-cost-governance.md
      repository-and-naming.md
      post-distribution-lifecycle.md
      requirements-trace.md
```

Recommended source code alignment:

```
  src/
    domain/
      workflow/
        states.ts
        transitions.ts
        guards.ts
        state-machine.test.ts
      evaluation/
        agents.ts
        schemas.ts
        orchestrator.ts
        quality-score.ts
      distribution/
        project-types.ts
        package-schema.ts
        monday-mapping.ts
        github-mapping.ts
      provisioning/
        jobs.ts
        idempotency.ts
        retries.ts
        dead-letter.ts
      permissions/
        roles.ts
        permissions.ts
      audit/
        audit-log.ts
```

The exact folders can vary by framework, but the concepts should remain separate and testable.

---

# **3\. Key Files and Their Purpose**

## **3.1 AGENTS.md**

Used by Codex and other coding agents as the repo-level instruction file.

It should contain:

* project purpose  
* build rules  
* test commands  
* logging requirements  
* code style  
* forbidden actions  
* task completion checklist

---

## **3.2 CLAUDE.md**

Used by Claude Code as the repo-level instruction file.

It should contain:

* Claude-specific operating instructions  
* required memory files to read first  
* required log files to update  
* safe command rules  
* approval expectations  
* handoff requirements

---

## **3.3 docs/ai/BUILD\_LOG.md**

Append-only chronological log of all AI-assisted work.

This is the main indexable build history.

Never rewrite older entries except to correct formatting errors.

---

## **3.4 docs/ai/MEMORY\_INDEX.md**

High-level index of project memory.

It should link to:

* active task logs  
* completed task logs  
* decision records  
* known constraints  
* open questions  
* module summaries  
* architecture notes

---

## **3.5 docs/ai/PROJECT\_MEMORY.md**

Durable project context for future agent sessions.

It should summarize:

* what the app is  
* architecture direction  
* current stack  
* important rules  
* current phase  
* what has already been built  
* what should not be changed casually

---

## **3.6 docs/ai/OPEN\_QUESTIONS.md**

Tracks unresolved questions.

Examples:

* Should Monday receive epics only or epics plus stories for this project type?  
* Which auth provider will be used?  
* Should GitHub repo creation happen automatically in v1?  
* Which database host will be used in staging?

---

## **3.7 docs/ai/KNOWN\_CONSTRAINTS.md**

Tracks project constraints.

Examples:

* internal-only app  
* monolith preferred  
* dual approval required  
* no deep bidirectional sync with Monday/GitHub  
* AI can draft but not approve  
* GitHub and Monday are distribution networks

---

## **3.8 docs/ai/decisions/ADR-\*.md**

Architecture Decision Records.

Use ADRs when a meaningful technical or product decision is made.

Examples:

* use modular monolith  
* use Postgres  
* use Markdown build memory  
* treat Monday/GitHub as distribution networks  
* use two approval gates

## **3.9 docs/product/\*.md**

The appendix-derived product specification files should summarize the durable product rules agents must implement.

These files should be treated as implementation references alongside `docs/ai/PROJECT_MEMORY.md` and `docs/ai/KNOWN_CONSTRAINTS.md`.

Recommended files:

| File | Purpose |
| :---- | :---- |
| `docs/product/workflow-state-machine.md` | Lifecycle states, transitions, guards, approval gates, retry behavior, audit invariants |
| `docs/product/ai-orchestration.md` | Multi-agent pipeline, agent roles, output contracts, quality scoring, regeneration rules |
| `docs/product/project-type-registry.md` | Canonical project types, GitHub requirement, evaluation depth, distribution mode |
| `docs/product/distribution-rules.md` | Monday Mode B/C rules, GitHub provisioning rules, idempotency requirements |
| `docs/product/permissions-and-ownership.md` | Roles, permission matrix, ownership transitions |
| `docs/product/failure-and-recovery.md` | Failure categories, retry strategies, dead-letter requirements |
| `docs/product/ai-cost-governance.md` | Model tiering, usage tracking, spend controls, cost optimization |
| `docs/product/repository-and-naming.md` | Repository naming, templates, labels, README requirements |
| `docs/product/post-distribution-lifecycle.md` | Lightweight lifecycle signals and sync boundaries |
| `docs/product/requirements-trace.md` | Appendix-to-task coverage map |

## **3.10 docs/ai/REQUIREMENTS\_TRACE.md**

Tracks which appendix requirements have been implemented, tested, deferred, or blocked.

Suggested columns:

| Requirement ID | Source Appendix | Requirement | Status | Task | Test Coverage | Notes |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| A-WF-001 | Appendix A | Distribution requires both approvals | planned | TASK-0011 | pending | Guard condition required |

Use this file when a task implements requirements from the appendices.

---

# **4\. Bootstrap Files**

## **4.1 AGENTS.md Template**

Create this file at the repo root.

```
# AGENTS.md

## Project

Digital Solutions Project Intake OS

## Purpose

This is an internal pre-distribution control plane for Digital Solutions projects. It captures discovery outputs, generates AI-assisted evaluations, routes projects through two approval gates, and distributes approved work to Monday and GitHub.

## Core Product Principle

The app owns the boundary.
Monday and GitHub distribute the work.
Developers own implementation.

## Agent Operating Rules

1. Read `docs/ai/PROJECT_MEMORY.md` before starting work.
2. Read `docs/ai/KNOWN_CONSTRAINTS.md` before making product or architecture decisions.
3. Check `docs/ai/OPEN_QUESTIONS.md` before assuming unresolved requirements.
4. Read relevant `docs/product/*.md` files before implementing workflow, AI, approval, distribution, provisioning, permission, recovery, cost, or lifecycle behavior.
5. Create or update a task log under `docs/ai/tasks/` for every assigned task.
6. Append a short entry to `docs/ai/BUILD_LOG.md` before finishing.
7. Update `docs/ai/MEMORY_INDEX.md` if new task logs or ADRs are created.
8. Update `docs/ai/REQUIREMENTS_TRACE.md` when implementing appendix-derived requirements.
9. Create an ADR under `docs/ai/decisions/` for meaningful architecture decisions.
10. Run relevant tests before marking a task complete.
11. Do not commit secrets.
12. Do not remove or rewrite build memory unless explicitly instructed.

## Current Architecture Direction

- Custom in-house monolith
- Internal-only first version
- Postgres as primary database
- Background worker for AI/provisioning jobs
- Deterministic request workflow state machine
- Two approval gates before provisioning or distribution
- Multi-agent AI evaluation pipeline with human approval authority
- Central project type registry for evaluation and distribution routing
- Monday and GitHub as downstream distribution channels
- Idempotent provisioning with external resource ID tracking
- Dead-letter handling for repeated integration/provisioning failures
- AI cost tracking by model, agent, tokens, regeneration count, and evaluation
- No heavy post-handoff bidirectional sync

## Required Completion Checklist

Before completing any task, ensure:

- [ ] Code changes are complete
- [ ] Relevant tests were run or skipped with explanation
- [ ] Task log was updated
- [ ] `BUILD_LOG.md` was appended
- [ ] `MEMORY_INDEX.md` was updated if needed
- [ ] Open questions were recorded
- [ ] Follow-up work was listed

## Forbidden Actions

Do not:

- add secrets to the repo
- delete memory logs
- bypass approval-related domain rules
- bypass state-machine guard conditions
- allow provisioning or distribution before both approval gates are complete
- mutate completed approval records
- create duplicate downstream resources during retries
- create production integrations without explicit instruction
- silently change product scope
- change project type, evaluation depth, or distribution routing rules without updating docs/tests
- overwrite downstream distribution rules without an ADR
```

---

## **4.2 CLAUDE.md Template**

Create this file at the repo root.

```
# CLAUDE.md

## Role

You are assisting with the implementation of the Digital Solutions Project Intake OS.

You are a coding agent, not the product owner.

## Required Reading Before Work

Before making changes, read:

1. `docs/ai/PROJECT_MEMORY.md`
2. `docs/ai/KNOWN_CONSTRAINTS.md`
3. `docs/ai/OPEN_QUESTIONS.md`
4. the relevant task file under `docs/ai/tasks/`, if one exists
5. any relevant `docs/product/*.md` specification file for the area being changed

## Logging Requirement

Every session must update Markdown memory.

For every task:

1. Create or update a task log in `docs/ai/tasks/`.
2. Append a chronological entry to `docs/ai/BUILD_LOG.md`.
3. Update `docs/ai/MEMORY_INDEX.md` if a new task, ADR, or major artifact is added.
4. Add unresolved items to `docs/ai/OPEN_QUESTIONS.md`.
5. Add architecture decisions to `docs/ai/decisions/`.

## Safety Rules

Ask for human confirmation before:

- deleting files
- changing database schema in a breaking way
- modifying authentication or permissions
- changing approval gate rules
- changing workflow state transitions or guard conditions
- changing project type registry defaults
- changing distribution mode logic
- changing provisioning behavior
- changing retry, idempotency, or dead-letter behavior
- touching secrets or credentials
- changing production deployment config

## Implementation Rules

Prefer small, reviewable changes.

For each task:

1. Inspect current files.
2. State the plan in the task log.
3. Implement the smallest useful slice.
4. Run tests or explain why they were not run.
5. Update memory files.
6. Leave a handoff summary.

## Product Boundary

The app is a pre-distribution control plane.

It owns:

- intake
- AI evaluation
- approval records
- distribution package
- provisioning history

It does not own:

- every GitHub issue update
- every Monday status update
- developer execution workflow

## Completion Response Format

When finishing a task, summarize:

- files changed
- tests run
- memory files updated
- risks or follow-ups
```

---

# **5\. Markdown Memory System**

## **5.1 BUILD\_LOG.md Template**

Create `docs/ai/BUILD_LOG.md`.

````
# Build Log

This file is append-only.

It records AI-assisted implementation activity for indexing, memory, and review.

---

## Entry Format

```text
Date:
Task ID:
Agent:
Branch:
Summary:
Files Changed:
Commands Run:
Tests:
Decisions:
Open Questions:
Next Steps:
Links:
````

---

````

Every agent should append entries under this format.

---

## 5.2 Task Log Template

Create `docs/ai/TASK_TEMPLATE.md`.

```markdown
# Task Log: [Task Title]

## Metadata

- Task ID:
- Date Started:
- Date Completed:
- Agent:
- Human Owner:
- Branch:
- Related Issue:
- Status: planned | in-progress | blocked | completed

---

## Request

What was the agent asked to do?

---

## Context Read

Files reviewed before implementation:

- `docs/ai/PROJECT_MEMORY.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/ai/OPEN_QUESTIONS.md`
- ...

---

## Plan

1.
2.
3.

---

## Implementation Notes

What changed and why?

---

## Files Changed

| File | Change Summary |
|---|---|
| | |

---

## Commands Run

```bash
# command
````

Result:

```
pass/fail summary
```

---

## **Tests**

* Unit tests  
* Integration tests  
* Typecheck  
* Lint  
* Manual verification

Notes:

---

## **Decisions Made**

List any decisions made during implementation.

If significant, create an ADR.

---

## **Open Questions**

Questions that need human review.

---

## **Handoff Summary**

Short summary for the next developer or agent.

---

## **Follow-Up Work**

* \[ \]  
* \[ \]

````

---

## 5.3 PROJECT_MEMORY.md Template

Create `docs/ai/PROJECT_MEMORY.md`.

```markdown
# Project Memory

## Product

Digital Solutions Project Intake OS

## One-Line Definition

An internal pre-distribution control plane that captures discovery outputs, generates AI-assisted evaluations, routes projects through two approvals, and distributes approved work to Monday and GitHub.

## Operating Principle

The app owns the boundary.
Monday and GitHub distribute the work.
Developers own implementation.

## Current Build Phase

[Update this as the project progresses]

## Current Architecture

- Modular monolith
- Internal-only app
- Postgres database
- Background jobs for AI/provisioning
- Markdown-based AI build memory

## Core Modules

- intake
- workflow state machine
- evaluation
- AI orchestration
- approval
- project type registry
- projects
- distribution package
- provisioning
- integrations
- permissions
- audit
- cost governance
- admin

## Hard Product Rules

1. No distribution without two approvals.
2. Approval Gate 2 cannot happen before Approval Gate 1.
3. Completed approval records are immutable.
4. Rejected requests cannot provision.
5. AI can draft; humans approve.
6. AI evaluations must be reviewable, versioned, and editable.
7. Project type drives evaluation depth, GitHub requirement, and distribution mode.
8. Monday and GitHub are distribution networks.
9. Provisioning must be idempotent and store external resource IDs.
10. Provisioning retries must not create duplicates.
11. Repeated failures must be inspectable and recoverable.
12. AI usage and regeneration cost must be tracked.
13. No deep post-handoff sync.
14. Developers may adjust implementation while preserving approved scope.

## Latest Status Summary

[Agents should update this after major milestones only.]

## Important Links

- Build Log: `docs/ai/BUILD_LOG.md`
- Memory Index: `docs/ai/MEMORY_INDEX.md`
- Open Questions: `docs/ai/OPEN_QUESTIONS.md`
- Known Constraints: `docs/ai/KNOWN_CONSTRAINTS.md`
````

---

## **5.4 MEMORY\_INDEX.md Template**

Create `docs/ai/MEMORY_INDEX.md`.

```
# Memory Index

This file indexes AI-generated project memory.

---

## Current Status

- Current phase:
- Last major milestone:
- Current blocker:

---

## Active Tasks

| Task ID | Title | Status | File |
|---|---|---|---|
| | | | |

---

## Completed Tasks

| Task ID | Title | Completed | File |
|---|---|---|---|
| | | | |

---

## Architecture Decisions

| ADR | Title | Status |
|---|---|---|
| ADR-0001 | Use modular monolith | accepted |

---

## Important Memory Files

- `docs/ai/PROJECT_MEMORY.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/ai/OPEN_QUESTIONS.md`
- `docs/ai/DECISIONS_SUMMARY.md`
- `docs/ai/BUILD_LOG.md`
```

---

## **5.5 OPEN\_QUESTIONS.md Template**

```
# Open Questions

Use this file to track unresolved product, technical, and operational questions.

| ID | Question | Owner | Status | Notes |
|---|---|---|---|---|
| Q-0001 | Which auth provider should v1 use? | Human | open | Google SSO likely, not confirmed |
```

---

## **5.6 KNOWN\_CONSTRAINTS.md Template**

```
# Known Constraints

## Product Constraints

- Internal-only first version
- Management and DevOps are primary intake users
- Two approvals required before distribution
- Approval records are immutable after completion
- AI assists evaluation but cannot approve projects
- Human review checkpoints are required
- Project type controls evaluation depth and downstream routing
- Monday and GitHub are distribution networks
- No deep bidirectional sync after handoff
- Only high-level post-distribution lifecycle signals are tracked

## Technical Constraints

- Prefer monolith
- Prefer durable Markdown memory in repo
- No secrets in repo
- Workflow transitions must be deterministic and tested
- External API actions must be logged
- External resource IDs must be persisted
- Provisioning must be retryable and idempotent
- Retry behavior must avoid duplicate downstream resources
- Partial provisioning states must be recoverable
- Repeated failures should move to dead-letter handling

## AI Constraints

- AI can draft evaluations, issues, and docs
- AI cannot approve projects
- AI cannot bypass approval gates
- AI cannot silently change project scope
- AI evaluation should use a staged multi-agent pipeline
- AI output must be structured, versioned, reviewable, and regenerable by section
- AI quality scoring should run before human review
- AI usage, tokens, model tier, regeneration count, and estimated cost must be tracked
```

---

# **6\. ADR Template**

Create `docs/ai/decisions/ADR-0000-template.md`.

```
# ADR-0000: [Decision Title]

## Status

proposed | accepted | rejected | superseded

## Date

YYYY-MM-DD

## Context

What problem or decision point led to this ADR?

## Decision

What did we decide?

## Consequences

What are the results of this decision?

## Alternatives Considered

- Option A
- Option B

## Related Files

-

## Related Tasks

-
```

---

# **7\. Initial ADRs to Create**

## **ADR-0001: Use a Modular Monolith**

```
# ADR-0001: Use a Modular Monolith

## Status

accepted

## Context

The system is an internal workflow-heavy application involving intake, AI evaluation, approval, provisioning, and audit history. These workflows are tightly connected and do not require independent service scaling in the first version.

## Decision

Build the first version as a modular monolith.

## Consequences

- Simpler development
- Easier state management
- Easier deployment
- Fewer distributed-system concerns
- Modules should still be kept clean internally

## Alternatives Considered

- Microservices
- n8n-centered workflow
- Monday-first implementation

## Related Files

- `docs/ai/PROJECT_MEMORY.md`
```

---

## **ADR-0002: Use Markdown as Durable Agent Memory**

```
# ADR-0002: Use Markdown as Durable Agent Memory

## Status

accepted

## Context

Codex, Claude Code, and other coding agents may each have their own session context, but the project needs tool-independent memory that future agents and humans can read.

## Decision

Use repository-stored Markdown files under `docs/ai/` as the durable memory layer.

## Consequences

- Build history is indexable
- Future agents can resume context
- Humans can audit AI-assisted work
- Agents must update memory as part of task completion

## Alternatives Considered

- Relying only on chat history
- Relying only on Git commits
- External knowledge base
```

---

## **ADR-0003: Treat Monday and GitHub as Distribution Networks**

```
# ADR-0003: Treat Monday and GitHub as Distribution Networks

## Status

accepted

## Context

The project should not continuously sync every downstream change from Monday and GitHub. That would create duplicated state and unnecessary complexity.

## Decision

The custom app owns intake, evaluation, approval, and distribution history. Monday and GitHub receive approved work packages and own downstream execution.

## Consequences

- Simpler sync model
- Less state duplication
- Clearer ownership
- The app records what was distributed, but does not mirror every downstream change
```

---

## **ADR-0004: Use the Appendix Workflow State Machine as the Domain Source of Truth**

```
# ADR-0004: Use the Appendix Workflow State Machine as the Domain Source of Truth

## Status

accepted

## Context

The intake lifecycle includes draft, submission, AI evaluation, clarification, two approval gates, provisioning, distribution, failure recovery, and archival. These steps need deterministic transitions and guard conditions.

## Decision

Implement the request lifecycle as a formal state machine based on the appendix specification.

## Consequences

- Transitions are testable
- Invalid approvals and provisioning attempts are blocked
- Audit history can be preserved consistently
- UI states can be derived from the workflow state

## Related Files

- `docs/product/workflow-state-machine.md`
- `src/domain/workflow/*`
```

---

## **ADR-0005: Use a Multi-Agent AI Evaluation Pipeline**

```
# ADR-0005: Use a Multi-Agent AI Evaluation Pipeline

## Status

accepted

## Context

The project evaluation process requires intake understanding, clarification, classification, architecture, low-code/custom-build tradeoffs, risk review, cost review, work breakdown, distribution planning, synthesis, and QA.

## Decision

Use a staged multi-agent pipeline with specialized agent roles and structured output contracts.

## Consequences

- Evaluations are easier to inspect and regenerate by section
- Specialist outputs can be tested independently
- Cost can be managed by model tier and evaluation depth
- Human reviewers retain approval authority

## Related Files

- `docs/product/ai-orchestration.md`
- `src/domain/evaluation/*`
```

---

## **ADR-0006: Enforce Idempotent Provisioning with External ID Tracking**

```
# ADR-0006: Enforce Idempotent Provisioning with External ID Tracking

## Status

accepted

## Context

Provisioning may create Monday items, GitHub repositories, labels, issues, README files, and templates. API failures and retries must not create duplicates.

## Decision

Persist external resource IDs, validate existence before creating resources, and implement retry-safe provisioning jobs.

## Consequences

- Retries are safer
- Partial provisioning can be recovered
- Duplicate repos, issues, and Monday items are easier to prevent
- Provisioning history becomes auditable

## Related Files

- `docs/product/distribution-rules.md`
- `docs/product/failure-and-recovery.md`
- `src/domain/provisioning/*`
```

---

## **ADR-0007: Centralize Project Type Routing Rules**

```
# ADR-0007: Centralize Project Type Routing Rules

## Status

accepted

## Context

Project type affects evaluation depth, GitHub requirement, Monday distribution mode, risk level, templates, and provisioning defaults.

## Decision

Implement a central project type registry rather than scattering project type logic across UI, AI prompts, and provisioning code.

## Consequences

- Routing behavior is easier to test
- New project types can be added intentionally
- AI classification and distribution logic share the same rules
- Product changes require one explicit update path

## Related Files

- `docs/product/project-type-registry.md`
- `src/domain/distribution/project-types.ts`
```

---

## **ADR-0008: Track Only Lightweight Post-Distribution Lifecycle Signals**

```
# ADR-0008: Track Only Lightweight Post-Distribution Lifecycle Signals

## Status

accepted

## Context

Deep synchronization with Monday and GitHub would duplicate downstream state and create unnecessary integration complexity.

## Decision

Track only high-level lifecycle signals after distribution: distributed, in progress, blocked, completed, archived, and canceled.

## Consequences

- Simpler sync model
- Less state duplication
- Clear ownership boundaries
- The app remains a pre-distribution control plane, not a delivery management clone

## Related Files

- `docs/product/post-distribution-lifecycle.md`
```

# **8\. Agent Task Lifecycle**

Every Codex or Claude Code task should follow this lifecycle.

```
1. Human creates task request
2. Agent reads memory files
3. Agent creates task log
4. Agent writes plan to task log
5. Agent implements changes
6. Agent runs tests/checks
7. Agent updates task log
8. Agent appends BUILD_LOG.md
9. Agent updates MEMORY_INDEX.md
10. Agent writes handoff summary
11. Human reviews
```

---

# **9\. Standard Task IDs**

Use this naming scheme:

```
TASK-0001-bootstrap-ai-memory
TASK-0002-create-app-shell
TASK-0003-add-auth-model
TASK-0004-create-request-model
TASK-0005-build-intake-form
```

File path:

```
docs/ai/tasks/TASK-0001-bootstrap-ai-memory.md
```

---

# **10\. Codex Build Workflow**

## **10.1 When to Use Codex**

Use Codex for:

* repo-wide implementation tasks  
* scaffolding modules  
* adding tests  
* bug fixing  
* refactoring  
* generating pull requests  
* reviewing GitHub issues  
* implementing isolated GitHub issues

Codex is especially useful when a task can be expressed as a concrete engineering outcome.

Examples:

```
Implement the request model and CRUD endpoints.
Add the approval state machine with tests.
Generate GitHub provisioning service from the distribution package schema.
Refactor evaluation validation into a separate module.
```

---

## **10.2 Codex Prompt Template**

Use this as the standard Codex task prompt.

````
# Codex Task

## Task ID

TASK-____

## Goal

[Describe the implementation goal.]

## Required Reading

Before changing code, read:

- `AGENTS.md`
- `docs/ai/PROJECT_MEMORY.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/ai/OPEN_QUESTIONS.md`
- `docs/ai/TASK_TEMPLATE.md`
- relevant `docs/product/*.md` files for the task area

## Required Logging

Create or update:

- `docs/ai/tasks/TASK-____-[slug].md`

Append to:

- `docs/ai/BUILD_LOG.md`

Update if needed:

- `docs/ai/MEMORY_INDEX.md`
- `docs/ai/OPEN_QUESTIONS.md`
- `docs/ai/decisions/ADR-____.md`

## Implementation Scope

In scope:

- [item]
- [item]

Out of scope:

- [item]
- [item]

## Constraints

- Do not change approval rules unless required by this task.
- Do not change workflow transitions, project type routing, provisioning behavior, or distribution rules without updating docs, tests, and ADRs where needed.
- Do not add secrets.
- Do not remove or rewrite existing AI memory files.
- Keep changes small and reviewable.

## Expected Checks

Run relevant checks, such as:

```bash
npm run lint
npm run typecheck
npm test
````

If a command is unavailable, log that in the task file.

## **Completion Requirements**

Before finishing:

* summarize files changed  
* summarize tests run  
* append build log  
* update task log  
* list open questions  
* list follow-up tasks

````

---

## 10.3 Codex Task Example

```markdown
# Codex Task

## Task ID

TASK-0004-create-request-model

## Goal

Create the initial request data model for the Project Intake OS.

## Required Reading

Read:

- `AGENTS.md`
- `docs/ai/PROJECT_MEMORY.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/ai/OPEN_QUESTIONS.md`

## Implementation Scope

In scope:

- add Request model to ORM schema
- include request number, requester, problem, goal, discovery notes, status, timestamps
- create migration
- add basic tests if test framework exists
- update AI memory files

Out of scope:

- UI forms
- authentication
- Monday/GitHub integrations
- AI evaluation logic

## Expected Checks

Run:

```bash
npm run typecheck
npm test
````

## **Completion Requirements**

Update:

* `docs/ai/tasks/TASK-0004-create-request-model.md`  
* `docs/ai/BUILD_LOG.md`  
* `docs/ai/MEMORY_INDEX.md`

````

---

# 11. Claude Code Build Workflow

## 11.1 When to Use Claude Code

Use Claude Code for:

- local repo exploration
- iterative implementation
- test-driven development
- refactoring
- debugging
- writing docs
- updating Markdown memory
- explaining unfamiliar code

Claude Code is especially useful when the developer wants an interactive local coding partner.

---

## 11.2 Claude Code Prompt Template

```markdown
You are working in the Digital Solutions Project Intake OS repository.

Task ID: TASK-____

Goal:
[Describe goal]

Before editing, read:
- CLAUDE.md
- docs/ai/PROJECT_MEMORY.md
- docs/ai/KNOWN_CONSTRAINTS.md
- docs/ai/OPEN_QUESTIONS.md
- relevant docs/product/*.md files for this task area

You must create or update:
- docs/ai/tasks/TASK-____-[slug].md

You must append to:
- docs/ai/BUILD_LOG.md

You must update if relevant:
- docs/ai/MEMORY_INDEX.md
- docs/ai/OPEN_QUESTIONS.md
- docs/ai/decisions/*.md

Implementation scope:
- [in scope item]
- [in scope item]

Out of scope:
- [out of scope item]

Rules:
- Keep changes small and reviewable.
- Do not delete memory files.
- Do not add secrets.
- Do not change approval gates without explicit instruction.
- Ask before destructive operations.

After implementation:
- run relevant tests/checks
- update task log
- append build log
- summarize files changed
- list follow-ups
````

---

## **11.3 Claude Code Example**

```
You are working in the Digital Solutions Project Intake OS repository.

Task ID: TASK-0007-approval-state-machine

Goal:
Implement the request approval state machine for Gate 1 and Gate 2.

Before editing, read:
- CLAUDE.md
- docs/ai/PROJECT_MEMORY.md
- docs/ai/KNOWN_CONSTRAINTS.md
- docs/ai/OPEN_QUESTIONS.md

You must create:
- docs/ai/tasks/TASK-0007-approval-state-machine.md

You must append to:
- docs/ai/BUILD_LOG.md

Implementation scope:
- define allowed request statuses
- define valid transitions
- add guard conditions for Gate 1 and Gate 2
- add tests for invalid transitions

Out of scope:
- UI approval screen
- Monday/GitHub provisioning
- authentication changes

Rules:
- Do not weaken the two-approval requirement.
- Do not allow distribution before Gate 1 and Gate 2 are both approved.
- Record any ambiguous rules in OPEN_QUESTIONS.md.
```

---

# **12\. Logging Script**

A small script can help standardize log entries.

Create `scripts/ai-log.sh`.

```shell
#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
AGENT="${2:-unknown}"
SUMMARY="${3:-}"

if [ -z "$TASK_ID" ] || [ -z "$SUMMARY" ]; then
  echo "Usage: scripts/ai-log.sh TASK_ID AGENT SUMMARY"
  exit 1
fi

DATE_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"

mkdir -p docs/ai

cat >> docs/ai/BUILD_LOG.md <<EOF

---

## $DATE_UTC - $TASK_ID

- Agent: $AGENT
- Branch: $BRANCH
- Summary: $SUMMARY
- Files Changed: See git diff / task log
- Commands Run: See task log
- Tests: See task log
- Decisions: See task log
- Open Questions: See task log
- Next Steps: See task log
EOF

echo "Appended build log entry for $TASK_ID"
```

Make executable:

```shell
chmod +x scripts/ai-log.sh
```

Example usage:

```shell
scripts/ai-log.sh TASK-0004 codex "Created initial request model and migration"
```

---

# **13\. Task Creation Script**

Create `scripts/ai-task.sh`.

```shell
#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
SLUG="${2:-}"
AGENT="${3:-unknown}"

if [ -z "$TASK_ID" ] || [ -z "$SLUG" ]; then
  echo "Usage: scripts/ai-task.sh TASK_ID slug agent"
  exit 1
fi

DATE_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
FILE="docs/ai/tasks/${TASK_ID}-${SLUG}.md"
BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"

mkdir -p docs/ai/tasks

if [ -f "$FILE" ]; then
  echo "Task file already exists: $FILE"
  exit 0
fi

cat > "$FILE" <<EOF
# Task Log: $TASK_ID - $SLUG

## Metadata

- Task ID: $TASK_ID
- Date Started: $DATE_UTC
- Date Completed:
- Agent: $AGENT
- Human Owner:
- Branch: $BRANCH
- Related Issue:
- Status: in-progress

---

## Request

TBD

---

## Context Read

- [ ] AGENTS.md or CLAUDE.md
- [ ] docs/ai/PROJECT_MEMORY.md
- [ ] docs/ai/KNOWN_CONSTRAINTS.md
- [ ] docs/ai/OPEN_QUESTIONS.md

---

## Plan

1. TBD

---

## Implementation Notes

TBD

---

## Files Changed

| File | Change Summary |
|---|---|
| | |

---

## Commands Run

TBD

---

## Tests

TBD

---

## Decisions Made

TBD

---

## Open Questions

TBD

---

## Handoff Summary

TBD

---

## Follow-Up Work

- [ ] TBD
EOF

echo "Created $FILE"
```

Make executable:

```shell
chmod +x scripts/ai-task.sh
```

Example:

```shell
scripts/ai-task.sh TASK-0004 create-request-model codex
```

---

# **14\. Optional Memory Index Update Script**

Create `scripts/update-ai-index.mjs`.

```javascript
import fs from "node:fs";
import path from "node:path";

const tasksDir = "docs/ai/tasks";
const decisionsDir = "docs/ai/decisions";
const indexFile = "docs/ai/MEMORY_INDEX.md";

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => path.join(dir, file));
}

const tasks = listMarkdownFiles(tasksDir);
const decisions = listMarkdownFiles(decisionsDir);

const content = `# Memory Index

This file is generated or refreshed from repository memory files.

---

## Active / Completed Task Logs

${tasks.map((file) => `- [${path.basename(file)}](${file.replace(/^docs\/ai\//, "")})`).join("\n") || "No task logs yet."}

---

## Architecture Decisions

${decisions.map((file) => `- [${path.basename(file)}](${file.replace(/^docs\/ai\//, "")})`).join("\n") || "No ADRs yet."}

---

## Important Memory Files

- [PROJECT_MEMORY.md](PROJECT_MEMORY.md)
- [KNOWN_CONSTRAINTS.md](KNOWN_CONSTRAINTS.md)
- [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)
- [BUILD_LOG.md](BUILD_LOG.md)
`;

fs.writeFileSync(indexFile, content);
console.log(`Updated ${indexFile}`);
```

Add package script:

```json
{
  "scripts": {
    "ai:index": "node scripts/update-ai-index.mjs"
  }
}
```

---

# **15\. Build Order for Agents**

Use agents in small implementation slices.

## **Phase 0: Repo Bootstrap**

Tasks:

```
TASK-0001-bootstrap-ai-memory
TASK-0002-create-project-scaffold
TASK-0003-add-dev-tooling
```

Agent focus:

* create docs/ai memory structure  
* create AGENTS.md  
* create CLAUDE.md  
* create logging scripts  
* create README  
* create app scaffold

---

## **Phase 1: Domain Model**

Tasks:

```
TASK-0004-create-request-model
TASK-0005-create-evaluation-model
TASK-0006-create-approval-model
TASK-0007-create-project-model
TASK-0008-create-provisioning-job-model
```

Agent focus:

* database schema  
* migrations  
* unit tests  
* model validation  
* seed data

---

## **Phase 2: State Machine**

Tasks:

```
TASK-0009-request-state-machine
TASK-0010-approval-gate-rules
TASK-0011-distribution-guard-conditions
```

Agent focus:

* allowed states  
* transitions  
* guard checks  
* tests for invalid transitions

---

## **Phase 3: Intake UI**

Tasks:

```
TASK-0012-request-dashboard
TASK-0013-intake-form
TASK-0014-request-detail-page
```

Agent focus:

* form components  
* validation  
* list/detail views  
* status display

---

## **Phase 4: AI Evaluation**

Tasks:

```
TASK-0015-evaluation-schema
TASK-0016-ai-service-interface
TASK-0017-generate-evaluation-job
TASK-0018-evaluation-review-ui
TASK-0019-clarification-questions
```

Agent focus:

* schema-first AI output  
* JSON validation  
* background job  
* evaluation display  
* clarification flow

---

## **Phase 5: Approval Workflow**

Tasks:

```
TASK-0020-gate-1-review-ui
TASK-0021-gate-2-review-ui
TASK-0022-approval-audit-logs
```

Agent focus:

* approval pages  
* state transitions  
* audit records  
* role permissions

---

## **Phase 6: Distribution Package**

Tasks:

```
TASK-0023-distribution-package-schema
TASK-0024-monday-payload-generator
TASK-0025-github-payload-generator
TASK-0026-distribution-preview-ui
```

Agent focus:

* generate payloads  
* validate payloads  
* show preview  
* block invalid distribution

---

## **Phase 7: Monday Integration**

Tasks:

```
TASK-0027-monday-client
TASK-0028-create-monday-project
TASK-0029-create-monday-epics
TASK-0030-create-monday-stories
TASK-0031-monday-provisioning-retry
```

Agent focus:

* API client  
* item creation  
* subitem creation  
* external ID storage  
* retry behavior

---

## **Phase 8: GitHub Integration**

Tasks:

```
TASK-0032-github-client
TASK-0033-create-github-repo
TASK-0034-create-github-labels
TASK-0035-create-github-readme
TASK-0036-create-github-issues
TASK-0037-github-provisioning-retry
```

Agent focus:

* repo creation  
* labels  
* README/docs  
* issue generation  
* external ID storage  
* retry behavior

---

## **Phase 9: Hardening**

Tasks:

```
TASK-0038-role-permissions
TASK-0039-error-dashboard
TASK-0040-ai-cost-logging
TASK-0041-sensitive-data-flag
TASK-0042-backup-runbook
TASK-0043-e2e-tests
```

Agent focus:

* security  
* observability  
* admin views  
* cost tracking  
* reliability

---

## **15.1 Appendix-to-Phase Coverage**

Use this coverage map to ensure appendix requirements are built intentionally rather than discovered late.

| Appendix | Build Phase | Primary Implementation Areas |
| :---- | :---- | :---- |
| Appendix A — Workflow State Machine | Phase 1, Phase 2, Phase 5, Phase 6 | request status model, state transitions, approval guards, provisioning guards, audit logs |
| Appendix B — Multi-Agent AI Orchestration | Phase 4, Phase 9 | agent contracts, shared context object, orchestrator, regeneration, quality scoring, cost tracking |
| Appendix C — Project Type Registry | Phase 1, Phase 4, Phase 6 | enum/registry, classifier, evaluation depth, distribution routing |
| Appendix D — Distribution Rules | Phase 6, Phase 7, Phase 8 | package schema, Monday Mode B/C, GitHub provisioning, idempotency |
| Appendix E — Permissions and Ownership | Phase 5, Phase 9 | roles, permission matrix, ownership transitions, admin controls |
| Appendix F — Failure and Recovery | Phase 7, Phase 8, Phase 9 | retry strategy, dead-letter jobs, recovery UI, authentication failure handling |
| Appendix G — AI Cost Governance | Phase 4, Phase 9 | usage logging, model tiering, regeneration limits, spend alerts |
| Appendix H — Repository and Naming | Phase 8 | repo naming, templates, labels, README generation |
| Appendix I — Post-Distribution Lifecycle | Phase 6, Phase 9 | lightweight status signals, downstream links, closure metadata |

## **15.2 Appendix-Integrated Build Order Adjustments**

The original phase order still works, but agents should apply these refinements:

* Phase 0 should create `docs/product/` and `docs/ai/REQUIREMENTS_TRACE.md`.  
* Phase 1 should model workflow states, evaluation versions, approval records, provisioning jobs, external resource references, audit logs, project type registry entries, and AI cost records early enough for later phases to use them.  
* Phase 2 should implement the complete appendix state machine and tests before UI approval work begins.  
* Phase 4 should implement the AI orchestrator as a multi-agent pipeline with evaluation-depth routing, section regeneration, quality scoring, and cost logging.  
* Phase 5 should implement the permission matrix and ownership transitions, not just approval buttons.  
* Phase 6 should generate distribution packages based on project type and distribution mode.  
* Phase 7 and Phase 8 should implement idempotency, retries, external ID persistence, collision handling, and dead-letter behavior as first-class requirements.  
* Phase 9 should harden permission checks, failure dashboards, AI cost governance, sensitive data flags, backup/runbook behavior, and lifecycle tracking.

## **15.3 Appendix-Derived Test Requirements**

Minimum tests required from the appendix specs:

| Area | Required Tests |
| :---- | :---- |
| Workflow | every valid transition succeeds; invalid transitions fail; rejected requests cannot provision |
| Approval | Gate 2 before Gate 1 fails; completed approval records cannot mutate; distribution blocked until both approvals are complete |
| Evaluation | light/standard/full evaluation depths select correct agents; invalid agent output is rejected; evaluation versions are preserved |
| Project Types | each project type maps to GitHub requirement, evaluation depth, and distribution mode |
| Distribution | Mode B excludes granular engineering tasks from Monday; Mode C includes stories/subtasks; GitHub provisioning only occurs when required |
| Provisioning | retry reuses existing external IDs; collision is detected; duplicate downstream creation is prevented |
| Failure Recovery | rate limits back off; auth failures require re-auth; repeated failures enter dead-letter state |
| Permissions | each role can perform only allowed actions; ownership transfers after Gate 1 and distribution |
| AI Cost | model usage, token usage, regeneration count, and estimated cost are recorded |
| Lifecycle | only high-level downstream statuses are tracked after distribution |

# **16\. Agent Pairing Strategy**

Use Codex and Claude Code differently.

## **16.1 Recommended Division of Labor**

| Work Type | Preferred Agent | Reason |
| :---- | :---- | :---- |
| GitHub issue implementation | Codex | Good for issue-to-PR style work |
| Local debugging | Claude Code | Strong interactive terminal workflow |
| Documentation updates | Claude Code or Codex | Either works if logging rules are clear |
| Repo-wide refactor | Codex | Good for scoped, reviewable PRs |
| Test-driven debugging | Claude Code | Good local iteration loop |
| Architecture review | Human \+ agent | Agent can draft, human decides |
| Memory cleanup | Claude Code | Good for Markdown-heavy organization |

---

## **16.2 Two-Agent Review Pattern**

For important tasks:

```
1. Codex implements the change.
2. Claude Code reviews locally.
3. Human reviews PR.
4. Agent updates memory with final result.
```

Or:

```
1. Claude Code explores and writes plan.
2. Codex implements from GitHub issue.
3. Claude Code runs local verification.
4. Human merges.
```

---

# **17\. PR Requirements**

Every PR should include:

```
- task ID
- summary
- files changed
- tests run
- memory files updated
- screenshots, if UI changed
- known risks
- follow-ups
```

PR template:

```
# Summary

## Task ID

TASK-____

## What Changed

-

## Tests Run

- [ ] lint
- [ ] typecheck
- [ ] unit tests
- [ ] integration tests
- [ ] manual QA

## AI Memory Updated

- [ ] `docs/ai/tasks/...`
- [ ] `docs/ai/BUILD_LOG.md`
- [ ] `docs/ai/MEMORY_INDEX.md`
- [ ] `docs/ai/OPEN_QUESTIONS.md`, if needed
- [ ] ADR, if needed

## Risks

-

## Follow-Ups

-
```

---

# **18\. Git Commit Guidance**

Use task IDs in commit messages.

Examples:

```
TASK-0004 add request model
TASK-0007 implement approval state machine
TASK-0024 add Monday payload generator
```

For AI-assisted commits, include co-author if appropriate according to your team policy.

Example:

```
TASK-0007 implement approval state machine

- Add request states
- Add transition guards
- Add tests for invalid transitions
- Update AI task log
```

---

# **19\. Required Log Entry Examples**

## **19.1 Simple Implementation Entry**

```
---

## 2026-05-15T10:22:00Z - TASK-0004

- Agent: codex
- Branch: feature/TASK-0004-request-model
- Summary: Added initial request model and migration.
- Files Changed:
  - `prisma/schema.prisma`
  - `docs/ai/tasks/TASK-0004-create-request-model.md`
  - `docs/ai/BUILD_LOG.md`
- Commands Run:
  - `npm run typecheck`
  - `npm test`
- Tests: typecheck passed; tests passed
- Decisions: request_number will be stored separately from UUID id
- Open Questions: Should request_number reset per year?
- Next Steps: Build intake form
```

---

## **19.2 Failed Task Entry**

```
---

## 2026-05-15T11:05:00Z - TASK-0028

- Agent: claude-code
- Branch: feature/TASK-0028-monday-project
- Summary: Attempted Monday project creation client; blocked by missing board ID and token.
- Files Changed:
  - `src/integrations/monday/client.ts`
  - `docs/ai/tasks/TASK-0028-create-monday-project.md`
  - `docs/ai/OPEN_QUESTIONS.md`
- Commands Run:
  - `npm run typecheck`
- Tests: typecheck passed; live API test skipped due missing credentials
- Decisions: Monday credentials will be read from environment variables only
- Open Questions: Need staging board ID and column mapping
- Next Steps: Human to provide Monday staging configuration
```

---

# **20\. Agent Review Checklist**

Before accepting AI-generated work, human reviewer should check:

```
- Does the code match the task scope?
- Did the agent update task log?
- Did the agent append BUILD_LOG.md?
- Did the agent update MEMORY_INDEX.md if needed?
- Are tests actually run?
- Did the agent create unnecessary files?
- Did it modify approval/distribution rules unexpectedly?
- Did it introduce secrets?
- Did it document open questions?
```

---

# **21\. Guardrails for Dangerous Work**

Agents must ask before:

```
- deleting files
- changing auth logic
- changing approval gate behavior
- changing workflow state transitions or invariants
- changing project type registry defaults
- changing distribution mode behavior
- changing provisioning idempotency or retry behavior
- adding new external write permissions
- modifying database schema destructively
- running destructive database commands
- touching production configs
- updating CI/CD secrets
- changing deployment infrastructure
```

Agents may proceed without asking for:

```
- adding tests
- adding docs
- creating task logs
- creating local-only scaffolding
- refactoring within a small approved scope
- adding non-breaking model fields during early development
```

---

# **22\. How to Teach Agents the Project Quickly**

When starting a new session, use this prompt.

```
You are working on the Digital Solutions Project Intake OS.

Before doing anything, read:

1. AGENTS.md or CLAUDE.md
2. docs/ai/PROJECT_MEMORY.md
3. docs/ai/MEMORY_INDEX.md
4. docs/ai/KNOWN_CONSTRAINTS.md
5. docs/ai/OPEN_QUESTIONS.md

Then summarize:

- what the app is
- current architecture
- current build phase
- relevant constraints
- what task you are about to do

Do not edit code until you have created or updated the task log.
```

---

# **23\. How to Resume Work from Memory**

Prompt:

```
Resume work on this repository from Markdown memory.

Read:

- docs/ai/PROJECT_MEMORY.md
- docs/ai/MEMORY_INDEX.md
- docs/ai/BUILD_LOG.md
- docs/ai/OPEN_QUESTIONS.md

Then identify:

1. last completed task
2. active task
3. current blockers
4. recommended next task
5. files likely relevant to the next task

Do not make changes yet. Produce a resume summary first.
```

---

# **24\. How to Hand Off Between Codex and Claude Code**

## **24.1 Codex to Claude Code**

Use this when Codex has made a PR or branch and Claude Code should verify it.

```
Review the changes from TASK-____.

Start by reading:

- docs/ai/tasks/TASK-____-[slug].md
- docs/ai/BUILD_LOG.md
- AGENTS.md
- CLAUDE.md

Then:

1. inspect the changed files
2. run relevant tests
3. identify bugs, missing tests, or scope creep
4. update the task log with review findings
5. append a BUILD_LOG.md review entry

Do not rewrite the implementation unless the fix is small and obvious. Otherwise, create follow-up tasks.
```

---

## **24.2 Claude Code to Codex**

Use this when Claude Code explored locally and Codex should implement.

```
Implement the task described in:

- docs/ai/tasks/TASK-____-[slug].md

Use the plan and constraints already written there.

Before editing, read:

- AGENTS.md
- docs/ai/PROJECT_MEMORY.md
- docs/ai/KNOWN_CONSTRAINTS.md

After implementation:

- update the task log
- append BUILD_LOG.md
- update MEMORY_INDEX.md if needed
- run tests
- summarize the PR
```

---

# **25\. Initial Task Breakdown for This Project**

Use these as the first agent-ready tasks.

## **TASK-0001: Bootstrap AI Memory**

Goal:

Create the AI memory/logging structure.

In scope:

* AGENTS.md  
* CLAUDE.md  
* docs/ai directory  
* docs/product directory  
* BUILD\_LOG.md  
* MEMORY\_INDEX.md  
* PROJECT\_MEMORY.md  
* OPEN\_QUESTIONS.md  
* KNOWN\_CONSTRAINTS.md  
* REQUIREMENTS\_TRACE.md  
* TASK\_TEMPLATE.md  
* ADR template  
* appendix-derived product spec files  
* logging scripts

Out of scope:

* app code  
* database  
* UI

---

## **TASK-0002: Create App Scaffold**

Goal:

Create the monolith app scaffold.

In scope:

* app framework setup  
* lint/typecheck/test scripts  
* initial README  
* .env.example  
* directory structure

Out of scope:

* domain models  
* integrations  
* auth implementation

---

## **TASK-0003: Add Database and ORM**

Goal:

Add Postgres/ORM setup.

In scope:

* ORM installation  
* database config  
* initial migration setup  
* local development instructions

Out of scope:

* production DB provisioning  
* auth model

---

## **TASK-0004: Request Model**

Goal:

Implement request data model.

In scope:

* request table/model  
* request status enum  
* request number field  
* basic validation  
* tests

---

## **TASK-0005: Evaluation Model**

Goal:

Implement AI evaluation storage.

In scope:

* evaluation table/model  
* evaluation versioning  
* JSON packet storage  
* extracted fields for filtering

---

## **TASK-0006: Approval Model**

Goal:

Implement approval records.

In scope:

* approval table/model  
* approval stage enum  
* decision enum  
* approver relation

---

## **TASK-0007: State Machine**

Goal:

Implement request lifecycle rules.

In scope:

* valid states  
* valid transitions  
* guard functions  
* unit tests

---

## **TASK-0008: Intake Form**

Goal:

Create internal intake form.

In scope:

* requester/client fields  
* problem  
* goal  
* discovery notes  
* systems involved  
* urgency  
* validation

---

## **TASK-0009: AI Evaluation Schema**

Goal:

Create schema for AI evaluation output.

In scope:

* project type enum  
* evaluation depth enum  
* implementation options  
* risks/assumptions/open questions  
* epics/stories  
* validation tests

---

## **TASK-0010: AI Evaluation Service Interface**

Goal:

Create interface for future AI provider integration.

In scope:

* provider abstraction  
* mock provider for tests  
* evaluation generation job shape

Out of scope:

* real API key setup  
* production provider config

---

## **TASK-0101: Product Spec Mirror from Appendices**

Goal:

Create focused product specification files from the appendices.

In scope:

* `docs/product/workflow-state-machine.md`  
* `docs/product/ai-orchestration.md`  
* `docs/product/project-type-registry.md`  
* `docs/product/distribution-rules.md`  
* `docs/product/permissions-and-ownership.md`  
* `docs/product/failure-and-recovery.md`  
* `docs/product/ai-cost-governance.md`  
* `docs/product/repository-and-naming.md`  
* `docs/product/post-distribution-lifecycle.md`  
* `docs/ai/REQUIREMENTS_TRACE.md`

Out of scope:

* app code  
* database schema  
* integrations

---

## **TASK-0102: Workflow State Machine Contract**

Goal:

Implement canonical request lifecycle states, transitions, guards, and tests.

In scope:

* state enum/constants  
* transition table  
* guard functions  
* invalid transition errors  
* approval and provisioning invariants  
* unit tests for all valid and invalid transitions

Out of scope:

* UI screens  
* external provisioning

---

## **TASK-0103: Project Type Registry**

Goal:

Implement the canonical project type registry used by AI evaluation and distribution planning.

In scope:

* project type constants/schema  
* GitHub requirement rule  
* default evaluation depth rule  
* default distribution mode rule  
* tests for every canonical type

Out of scope:

* AI classifier implementation  
* provisioning implementation

---

## **TASK-0104: AI Agent Output Contracts**

Goal:

Create structured schemas for each AI evaluation agent and the shared context object.

In scope:

* shared context schema  
* minimum agent output contract  
* specialist output schemas where needed  
* validation tests  
* mock outputs for light, standard, and full evaluations

Out of scope:

* live model calls  
* production API keys

---

## **TASK-0105: AI Evaluation Orchestrator**

Goal:

Implement the staged multi-agent evaluation pipeline.

In scope:

* Stage 1 intake normalization  
* Stage 2 parallel evaluation interface  
* Stage 3 synthesis and work breakdown  
* Stage 4 QA/critic review  
* Stage 5 handoff to human review  
* evaluation-depth routing  
* section regeneration hooks  
* quality score model  
* cost logging hooks

Out of scope:

* final production prompts  
* live provider configuration

---

## **TASK-0106: Permission and Ownership Matrix**

Goal:

Implement canonical roles, allowed actions, and ownership transitions.

In scope:

* Request Creator, Intake Owner, DevOps Lead, Developer, Admin roles  
* permission checks for create/edit/submit/evaluate/approve/provision/retry/audit/manage integrations  
* Gate 1 ownership transfer  
* Gate 2/DevOps ownership rules  
* tests for allowed and blocked actions

Out of scope:

* full authentication provider setup unless already selected

---

## **TASK-0107: Provisioning Idempotency and Failure Recovery**

Goal:

Implement retry-safe provisioning foundations before Monday/GitHub live writes.

In scope:

* provisioning job schema  
* external resource reference schema  
* idempotency key strategy  
* per-step retry support  
* collision detection hooks  
* dead-letter state  
* failure payload preservation  
* tests for duplicate prevention and retry behavior

Out of scope:

* live Monday/GitHub API clients

---

## **TASK-0108: AI Cost Governance**

Goal:

Track and govern AI usage by evaluation, agent, model, and regeneration.

In scope:

* AI usage record model  
* token/model/cost fields  
* regeneration count tracking  
* model tier labels  
* cost summary helpers  
* guard hooks for expensive evaluations

Out of scope:

* billing integration  
* production spend alert provider

---

## **TASK-0109: Repository Naming and GitHub Template Rules**

Goal:

Implement GitHub repository naming and default provisioning standards.

In scope:

* repo name generator  
* collision validation hook  
* default labels  
* README generation contract  
* issue/template mapping contract  
* tests for naming examples

Out of scope:

* live GitHub repo creation

---

## **TASK-0110: Lightweight Post-Distribution Lifecycle**

Goal:

Implement high-level lifecycle tracking after handoff without deep downstream sync.

In scope:

* lifecycle status enum  
* downstream link storage  
* completion timestamp fields  
* closure metadata  
* tests that issue-level and PR-level mirroring are not required by the domain model

Out of scope:

* continuous GitHub/Monday sync

# **26\. Setup Checklist for Developers**

Before using Codex or Claude Code on this repo:

```
- clone repo
- install dependencies
- copy .env.example to .env.local
- confirm no production secrets are present
- read AGENTS.md
- read CLAUDE.md
- read docs/ai/PROJECT_MEMORY.md
- run baseline tests
- create task branch
- create task log
```

Example:

```shell
git checkout -b feature/TASK-0004-request-model
scripts/ai-task.sh TASK-0004 create-request-model human
npm install
npm run typecheck
npm test
```

---

# **27\. Exact Rule for Logging Every Step**

For this project, "log every step" means every meaningful step, not every keystroke.

Log these:

```
- task started
- files inspected
- implementation plan
- important code changes
- commands run
- test results
- failed attempts
- decisions made
- blockers
- task completed
- handoff summary
```

Do not log noise like:

```
- every individual line edit
- every cursor movement
- every package manager progress line
```

The goal is useful memory, not clutter.

---

# **28\. Daily Log Option**

For long build sessions, also maintain daily notes.

File:

```
docs/ai/daily/YYYY-MM-DD.md
```

Template:

```
# Daily AI Build Notes - YYYY-MM-DD

## Work Completed

-

## Tasks Touched

-

## Decisions

-

## Blockers

-

## Next Recommended Work

-
```

Agents should use daily logs only for long sessions or multi-task work.

---

# **29\. Indexing and Retrieval Strategy**

The Markdown memory system should be easy to index later.

Use consistent headings:

```
## Metadata
## Request
## Plan
## Implementation Notes
## Files Changed
## Commands Run
## Tests
## Decisions Made
## Open Questions
## Handoff Summary
```

Use consistent IDs:

```
TASK-0001
ADR-0001
Q-0001
PRJ-0001
REQ-0001
```

Use relative links between files.

Example:

```
Related:

- [TASK-0007 Approval State Machine](tasks/TASK-0007-approval-state-machine.md)
- [ADR-0001 Modular Monolith](decisions/ADR-0001-use-modular-monolith.md)
```

---

# **30\. Memory Hygiene Rules**

## **30.1 Do**

* keep logs short but complete  
* use task IDs  
* link related ADRs  
* list commands and test results  
* capture open questions  
* summarize decisions  
* update project memory after milestones

## **30.2 Do Not**

* paste giant diffs into logs  
* duplicate full source files in memory  
* rewrite history casually  
* mix unrelated tasks in one task log  
* let agents make undocumented architecture changes  
* let memory files become marketing docs

---

# **31\. Suggested Human Review Cadence**

During initial build:

```
Review after every task or small PR.
```

After the foundation stabilizes:

```
Review after each phase.
```

Always review manually before merging changes that affect:

* approval gates  
* provisioning  
* external API write actions  
* auth/permissions  
* database migrations  
* AI prompt behavior

---

# **32\. Minimal First Agent Prompt**

Use this to start the first task.

```
We are building the Digital Solutions Project Intake OS.

Your first task is TASK-0001-bootstrap-ai-memory.

Create the repository AI memory system.

Add:

- AGENTS.md
- CLAUDE.md
- docs/ai/BUILD_LOG.md
- docs/ai/MEMORY_INDEX.md
- docs/ai/PROJECT_MEMORY.md
- docs/ai/OPEN_QUESTIONS.md
- docs/ai/KNOWN_CONSTRAINTS.md
- docs/ai/TASK_TEMPLATE.md
- docs/ai/HANDOFF_TEMPLATE.md
- docs/ai/REQUIREMENTS_TRACE.md
- docs/product/README.md
- docs/product/workflow-state-machine.md
- docs/product/ai-orchestration.md
- docs/product/project-type-registry.md
- docs/product/distribution-rules.md
- docs/product/permissions-and-ownership.md
- docs/product/failure-and-recovery.md
- docs/product/ai-cost-governance.md
- docs/product/repository-and-naming.md
- docs/product/post-distribution-lifecycle.md
- docs/ai/decisions/ADR-0000-template.md
- docs/ai/tasks/TASK-0001-bootstrap-ai-memory.md
- scripts/ai-log.sh
- scripts/ai-task.sh

Rules:

- Do not add app code yet.
- Do not add secrets.
- Use Markdown files as durable memory.
- Treat the appendix-derived product spec files as implementation contracts.
- Append a BUILD_LOG entry before finishing.
- Update MEMORY_INDEX.md with the created files.
- Initialize REQUIREMENTS_TRACE.md with appendix requirement groups and planned task coverage.
```

---

# **33\. Build Completion Definition**

The AI-assisted build process is working when:

```
- every task has a task log
- BUILD_LOG.md shows chronological history
- MEMORY_INDEX.md can tell a new agent where to start
- PROJECT_MEMORY.md summarizes the current system state
- ADRs explain major decisions
- PRs include memory updates
- agents can resume work from repo memory without relying on chat history
```

---

# **34\. Final Operating Rules**

```
1. Every agent session starts by reading memory.
2. Every agent task creates or updates a task log.
3. Every completed task appends BUILD_LOG.md.
4. Every major architecture decision gets an ADR.
5. Every unresolved requirement goes to OPEN_QUESTIONS.md.
6. Every PR includes memory updates.
7. Agents may build, but humans approve scope and architecture.
8. The repository is the durable memory.
```

---

# **35\. Final Summary**

Codex and Claude Code should be treated as implementation agents operating inside a documented build protocol.

The durable memory layer is not the tool.

The durable memory layer is the repository.

By requiring every agent to update Markdown logs, task files, decisions, and open questions, the project becomes easier to resume, review, index, and hand off.

The target outcome is:

```
AI-assisted implementation without AI-induced amnesia.
```

After the appendix integration, the target outcome is also:

```
AI-assisted implementation without losing product governance.
```

The build guide now requires agents to preserve both kinds of memory:

* build memory: what changed, why, and how it was tested  
* product memory: what the system is allowed to do, what it must never do, and which appendix requirement each implementation task satisfies


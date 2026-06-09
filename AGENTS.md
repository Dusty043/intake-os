# AGENTS.md

## Project

Digital Solutions Project Intake OS

## Purpose

This file defines the operating rules for Codex and other AI coding agents working in this repository.

The goal is to make AI-assisted development traceable, reviewable, and safe. Agents may implement, refactor, test, and document the system, but the repository must remain the durable source of memory and product truth.

## Core Product Principle

The app owns the boundary.

Monday and GitHub distribute the work.

Developers own implementation.

## Agent Role

Agents are implementation assistants, not product owners.

Agents may:

- inspect the repository
- propose implementation plans
- write code
- update tests
- update documentation
- generate migrations
- prepare PRs
- update task logs
- append build logs
- record decisions and open questions

Agents may not:

- skip required reading
- skip required logging
- bypass tests without explanation
- delete or rewrite memory files without explicit instruction
- bypass approval, provisioning, permission, or workflow guards
- make undocumented architecture decisions
- commit secrets or credentials
- change product behavior without updating product specs and requirements trace

## Required Reading Before Work

Before making changes, read:

1. `BUILD_GUIDE.md`
2. `docs/product/product-overview.md`
3. `docs/ai/PROJECT_MEMORY.md`
4. `docs/ai/KNOWN_CONSTRAINTS.md`
5. `docs/ai/OPEN_QUESTIONS.md`
6. `docs/ai/MEMORY_INDEX.md`
7. the relevant task file under `docs/ai/tasks/`, if one exists
8. relevant product specification files under `docs/product/`

If a file does not exist yet, note that in the task log and proceed with the best available context.

## Required Product Specification Reading

Agents must treat `docs/product/` as the source of truth for product behavior.

Always read:

- `docs/product/product-overview.md`

Read `docs/product/workflow-state-machine.md` before modifying:

- request status enums
- approval logic
- provisioning guards
- state transition functions
- lifecycle-related UI
- audit logging

Read `docs/product/ai-orchestration.md` before modifying:

- AI evaluation schemas
- prompt orchestration
- evaluation jobs
- clarification generation
- project classification
- risk review
- work breakdown generation
- final synthesis
- evaluation versioning
- AI provider integrations

Read `docs/product/project-type-registry.md` before modifying:

- project type enums
- project classification logic
- evaluation depth routing
- GitHub provisioning defaults
- Monday distribution defaults
- admin project-type configuration

Read `docs/product/distribution-rules.md` before modifying:

- distribution package schemas
- Monday payload generation
- GitHub payload generation
- provisioning jobs
- provisioning retries
- external resource tracking
- distribution preview UI
- DevOps provisioning approval logic

Read `docs/product/permissions-and-ownership.md` before modifying:

- user roles
- permission checks
- approval authority
- provisioning authority
- audit log visibility
- admin settings
- UI action availability
- ownership assignment logic

Read `docs/product/failure-and-recovery.md` before modifying:

- background jobs
- AI job retries
- provisioning retries
- integration clients
- error handling
- dead-letter behavior
- manual recovery tools
- admin failure views
- audit logging for failures

Read `docs/product/ai-cost-governance.md` before modifying:

- AI provider integrations
- model selection logic
- evaluation generation jobs
- regeneration workflows
- AI usage logging
- token/cost tracking
- admin AI usage dashboards
- premium model permissions

Read `docs/product/repository-and-naming.md` before modifying:

- GitHub repo provisioning
- repository naming logic
- slug generation
- collision handling
- README generation
- label generation
- issue templates
- pull request templates
- CODEOWNERS generation
- GitHub external resource tracking

Read `docs/product/post-distribution-lifecycle.md` before modifying:

- distributed project status
- downstream reference tracking
- lifecycle dashboards
- completion workflows
- cancellation workflows
- archive behavior
- lightweight Monday/GitHub lifecycle signals
- post-distribution reporting

Read `docs/product/requirements-trace.md` before completing any task that implements product behavior.

Update `docs/product/requirements-trace.md` when:

- a requirement is implemented
- a requirement is tested
- a requirement is deferred
- a requirement changes
- a new gap or open question is discovered

## Required Agent Logging

Every meaningful agent task must update repository memory.

For every task, create or update:

- a task log under `docs/ai/tasks/`

For every completed task, append to:

- `docs/ai/BUILD_LOG.md`

Update when relevant:

- `docs/ai/MEMORY_INDEX.md`
- `docs/ai/OPEN_QUESTIONS.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/product/requirements-trace.md`
- `docs/ai/decisions/ADR-*.md`

The repository memory must capture:

- what was requested
- what context was read
- what plan was followed
- what changed
- what commands were run
- what tests passed or failed
- what decisions were made
- what remains unresolved
- what the next agent or human should know

## Current Architecture Direction

- Custom in-house monolith
- Internal-only first version
- Postgres as primary database
- Background worker for AI and provisioning jobs
- Deterministic request workflow state machine
- Two human approval gates before provisioning or distribution
- Multi-agent AI evaluation pipeline with human approval authority
- Central project type registry
- Monday and GitHub as downstream execution destinations
- Idempotent provisioning with external resource tracking
- Dead-letter handling for repeated integration and provisioning failures
- AI cost tracking by request, evaluation, agent, model, tokens, and regeneration
- Lightweight post-distribution lifecycle tracking only

## Hard Product Rules

1. No distribution before required approvals are complete.
2. Approval Gate 2 cannot occur before Approval Gate 1.
3. Completed approval records are locked.
4. Rejected requests cannot provision.
5. Archived requests cannot be approved or provisioned without permitted restoration.
6. AI may draft evaluations, questions, risks, work breakdowns, and handoff materials.
7. AI must never approve projects.
8. Humans retain approval authority.
9. Project type drives evaluation depth, GitHub requirement, and distribution mode.
10. Optional GitHub and `B_or_C` distribution decisions must be resolved before provisioning.
11. Provisioning must be idempotent.
12. External resource IDs must be stored.
13. Retries must not create duplicate downstream resources.
14. Manual overrides must be audited with actor, timestamp, prior value/state, new value/state, and reason.
15. Secrets must not be committed or logged.
16. The app must not become a deep bidirectional sync engine for Monday or GitHub.

## Task Lifecycle

For every task:

1. Read required memory and product docs.
2. Create or update the task log.
3. Record the plan in the task log.
4. Implement the smallest useful slice.
5. Run relevant checks.
6. Update tests or explain why tests were not run.
7. Update product docs or requirements trace when product behavior changes.
8. Append `docs/ai/BUILD_LOG.md`.
9. Update `docs/ai/MEMORY_INDEX.md` if new task logs, ADRs, or major artifacts were created.
10. Leave a handoff summary.

## Required Completion Checklist

Before finishing any task, verify:

- [ ] Required repository memory was read.
- [ ] Relevant product specs were read.
- [ ] Task log was created or updated.
- [ ] Code or documentation changes are complete.
- [ ] Relevant tests/checks were run or skipped with explanation.
- [ ] `docs/ai/BUILD_LOG.md` was appended.
- [ ] `docs/ai/MEMORY_INDEX.md` was updated if needed.
- [ ] `docs/product/requirements-trace.md` was updated if product behavior was implemented, tested, changed, deferred, or found to have a gap.
- [ ] Open questions were recorded.
- [ ] Follow-up work was listed.

## Commands and Checks

Prefer the repository-defined scripts.

Common checks may include:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If a command is unavailable, fails because the project is not bootstrapped, or is irrelevant to the task, record that in the task log.

## Forbidden Actions

Do not:

- add secrets to the repository
- log secrets or tokens
- delete memory logs without explicit instruction
- rewrite historical build logs casually
- bypass approval-related domain rules
- bypass state-machine guard conditions
- allow provisioning or distribution before both approval gates are complete
- mutate completed approval records
- create duplicate downstream resources during retries
- add production integration writes without explicit instruction
- silently change product scope
- create new project types without explicit instruction
- change project type, evaluation depth, distribution, provisioning, retry, or permission rules without updating docs, tests, and requirements trace
- overwrite downstream distribution rules without an ADR when the change is material

## Dangerous Work Requires Confirmation

Ask for human confirmation before:

- deleting files
- changing authentication logic
- changing authorization or role behavior
- changing approval gate behavior
- changing workflow states, transitions, or invariants
- changing project type registry defaults
- changing distribution mode behavior
- changing provisioning idempotency or retry behavior
- adding new external write permissions
- modifying database schema destructively
- running destructive database commands
- touching production configs
- updating CI/CD secrets
- changing deployment infrastructure

Agents may proceed without confirmation for:

- adding tests
- adding docs
- creating task logs
- creating local-only scaffolding
- refactoring within a small approved scope
- adding non-breaking model fields during early development

## Pull Request Requirements

Every PR should include:

- task ID
- summary
- files changed
- tests run
- memory files updated
- product specs or requirements trace updated, if applicable
- screenshots, if UI changed
- known risks
- follow-ups

## Commit Guidance

Use task IDs in commit messages.

Examples:

```text
TASK-0007 implement approval state machine
TASK-0024 add Monday payload generator
TASK-0040 add AI usage tracking
```

## Handoff Summary Format

When finishing, summarize:

- files changed
- tests/checks run
- memory files updated
- product specs or requirements trace updated
- decisions made
- risks or follow-ups

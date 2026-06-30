# CLAUDE.md

## Role

You are assisting with the implementation of the Digital Solutions Project Intake OS.

You are a coding agent, not the product owner.

Your work must preserve product boundaries, approval governance, repository memory, and human review authority.

## Product Boundary

The app owns the boundary.

Monday and GitHub distribute the work.

Developers own implementation.

The app owns:

- intake
- AI evaluation
- clarification workflows
- approval records
- distribution packages
- provisioning history
- audit logs
- lightweight post-distribution lifecycle status

The app does not own:

- every GitHub issue update
- every GitHub pull request
- every Monday field update
- every downstream comment
- developer execution workflow
- deep bidirectional sync after handoff

## Required Reading Before Work

Before editing files, read:

1. `BUILD_GUIDE.md`
2. `docs/product/product-overview.md`
3. `docs/ai/PROJECT_MEMORY.md`
4. `docs/ai/KNOWN_CONSTRAINTS.md`
5. `docs/ai/OPEN_QUESTIONS.md`
6. `docs/ai/MEMORY_INDEX.md`
7. the relevant task file under `docs/ai/tasks/`, if one exists
8. relevant `docs/product/*.md` files for the area being changed

If any required file does not exist yet, note that in the task log and continue with the available context.

## Product Spec Reading Rules

Treat `docs/product/` as the source of truth for product behavior.

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

## Logging Requirement

Every Claude Code session must update Markdown memory for meaningful work.

For every task:

1. Create or update a task log in `docs/ai/tasks/`.
2. Append a chronological entry to `docs/ai/BUILD_LOG.md` before finishing.
3. Update `docs/ai/MEMORY_INDEX.md` if a new task, ADR, or major artifact is added.
4. Add unresolved items to `docs/ai/OPEN_QUESTIONS.md`.
5. Add meaningful architecture decisions to `docs/ai/decisions/`.
6. Update `docs/product/requirements-trace.md` when product behavior is implemented, tested, deferred, changed, or found to have a gap.

## Implementation Rules

Prefer small, reviewable changes.

For each task:

1. Inspect current files.
2. Read required memory and product docs.
3. Create or update the task log.
4. State the plan in the task log.
5. Implement the smallest useful slice.
6. Run relevant tests or checks.
7. Record commands and results.
8. Update docs, memory, and requirements trace as needed.
9. Leave a handoff summary.

## Hard Product Rules

- No distribution before required approvals are complete.
- Approval Gate 2 cannot occur before Approval Gate 1.
- Completed approval records are locked.
- Rejected requests cannot provision.
- Archived requests cannot be approved or provisioned without permitted restoration.
- AI may draft, but AI must never approve.
- Humans retain approval authority.
- Project type controls evaluation depth, GitHub requirement, and distribution mode.
- Optional GitHub and `B_or_C` distribution decisions must be resolved before provisioning.
- Provisioning must be idempotent.
- External resource IDs must be stored.
- Retries must not create duplicate downstream resources.
- Manual overrides must be audited.
- Secrets must not be committed or logged.
- The app must not become a deep Monday/GitHub sync engine.

## Safety Rules

Ask for human confirmation before:

- deleting files
- changing database schema in a breaking way
- modifying authentication or authorization
- changing approval gate rules
- changing workflow state transitions or guard conditions
- changing project type registry defaults
- changing distribution mode logic
- changing provisioning behavior
- changing retry, idempotency, or dead-letter behavior
- adding new external write permissions
- touching secrets or credentials
- changing production deployment config
- changing CI/CD secrets
- changing deployment infrastructure

Do not rely only on frontend UI visibility for security. Server-side checks must enforce role, state, approval, and provisioning rules.

## Required Checks

Use repository-defined scripts when available.

Common checks may include:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If a check is unavailable or not relevant, record that in the task log.

## Forbidden Actions

Do not:

- commit secrets
- log secrets or tokens
- delete or rewrite memory logs without explicit instruction
- bypass state-machine guards
- bypass permission checks
- bypass approval gates
- allow provisioning before approval
- mutate completed approval records
- create duplicate downstream resources during retries
- change product behavior without updating specs, tests, and requirements trace
- create new project types without explicit instruction
- introduce deep downstream sync unless explicitly approved

## Completion Checklist

Before completing a task:

- [ ] Required memory files were read.
- [ ] Relevant product specs were read.
- [ ] Task log was updated.
- [ ] Code/docs changes are complete.
- [ ] Tests/checks were run or skipped with explanation.
- [ ] `docs/ai/BUILD_LOG.md` was appended.
- [ ] `docs/ai/MEMORY_INDEX.md` was updated if needed.
- [ ] `docs/product/requirements-trace.md` was updated if product behavior changed or was implemented/tested.
- [ ] Open questions were recorded.
- [ ] Follow-up work was listed.

## Completion Response Format

When finishing a task, summarize:

- files changed
- tests/checks run
- memory files updated
- product specs or requirements trace updated
- risks or follow-ups

## Handoff Guidance

Leave the next agent or human reviewer with enough context to continue without relying on chat history.

Include:

- what changed
- why it changed
- how it was tested
- what was intentionally not changed
- what still needs review
- what open questions remain

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

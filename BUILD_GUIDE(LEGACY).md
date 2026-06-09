# Build Guide for Codex and Claude Code

## 1. Purpose
This guide explains how Codex, Claude Code, and human reviewers should work on the Digital Solutions Project Intake OS repository.
It is the operating manual for AI-assisted development. It does not define the full product specification. Product behavior belongs in `docs/product/`.
The goal is traceable, reviewable, resumable development where the repository contains the durable memory of the build.

## 2. Core Principle
The repository is the durable memory.
Agent session memory is temporary. Repository Markdown memory is durable.
Every meaningful task must record what was requested, what context was read, what changed, what commands ran, what tests passed or failed, what decisions were made, and what still needs review.
Agents may build, refactor, test, document, and prepare handoffs. They may not silently change product scope, bypass approval rules, remove memory, commit secrets, or make unreviewed production decisions.

## 3. Repository Memory Rules
Use Markdown files under `docs/ai/` as shared project memory.
Required memory files:
- `docs/ai/BUILD_LOG.md`
- `docs/ai/MEMORY_INDEX.md`
- `docs/ai/PROJECT_MEMORY.md`
- `docs/ai/OPEN_QUESTIONS.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/ai/DECISIONS_SUMMARY.md`
- `docs/ai/TASK_TEMPLATE.md`
- `docs/ai/HANDOFF_TEMPLATE.md`
- `docs/ai/REQUIREMENTS_TRACE.md`
- `docs/ai/tasks/`
- `docs/ai/decisions/`
- `docs/ai/daily/`
Rules:
- Create or update one task log per task.
- Append to `BUILD_LOG.md` before finishing work.
- Update `MEMORY_INDEX.md` when tasks, ADRs, or major memory files are added.
- Record unresolved questions in `OPEN_QUESTIONS.md`.
- Record major architecture decisions as ADRs.
- Do not rewrite historical logs unless correcting formatting or explicitly instructed.

## 4. Required Agent Reading
Before editing code or documentation, agents must read:
- `AGENTS.md` or `CLAUDE.md`
- `docs/ai/PROJECT_MEMORY.md`
- `docs/ai/MEMORY_INDEX.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/ai/OPEN_QUESTIONS.md`
- the active task file under `docs/ai/tasks/`, if one exists
- relevant `docs/product/*.md` files for the behavior being changed
Agents should summarize the current task, constraints, and intended plan in the task log before implementation.

## Product Specification Sources
Agents must treat the files under `docs/product/` as the source of truth for product behavior.
Required product specs:
- `docs/product/product-overview.md`
- `docs/product/workflow-state-machine.md`
- `docs/product/ai-orchestration.md`
- `docs/product/project-type-registry.md`
- `docs/product/distribution-rules.md`
- `docs/product/permissions-and-ownership.md`
- `docs/product/failure-and-recovery.md`
- `docs/product/ai-cost-governance.md`
- `docs/product/repository-and-naming.md`
- `docs/product/post-distribution-lifecycle.md`
- `docs/product/requirements-trace.md`
Do not duplicate full product rules in this guide.

## 5. Required Agent Logging
Every task must produce:
1. a task log under `docs/ai/tasks/`
2. a `BUILD_LOG.md` entry
3. memory updates, if relevant
4. an ADR, if architecture changed
5. a handoff summary
Log meaningful steps, not keystrokes: task started, files inspected, plan, important changes, commands run, test results, failed attempts, decisions, blockers, completion, and handoff.
Do not paste large diffs or full source files into logs.

## 6. Repository Structure
Recommended repository shape:
```text
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
      BUILD_LOG.md
      MEMORY_INDEX.md
      PROJECT_MEMORY.md
      OPEN_QUESTIONS.md
      KNOWN_CONSTRAINTS.md
      DECISIONS_SUMMARY.md
      REQUIREMENTS_TRACE.md
      TASK_TEMPLATE.md
      HANDOFF_TEMPLATE.md
      tasks/
      decisions/
      prompts/
      daily/
    product/
      product-overview.md
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
The exact application folders may vary by framework, but domain boundaries should remain clear and testable.

## 7. Agent Task Lifecycle
Every task should follow this lifecycle:
1. Human creates or assigns a task.
2. Agent reads required memory and product docs.
3. Agent creates or updates the task log.
4. Agent writes a short plan in the task log.
5. Agent implements the smallest useful slice.
6. Agent runs relevant checks.
7. Agent records commands and results.
8. Agent updates memory files.
9. Agent writes a handoff summary.
10. Human reviews the work.
Prefer small, reviewable tasks over broad changes.

## 8. Codex Workflow
Use Codex for scoped implementation work, repo-wide changes, refactors, tests, bug fixes, and issue-to-PR tasks.
A Codex prompt should include task ID, goal, required reading, required logging, scope, out-of-scope items, constraints, expected checks, and completion requirements.
Codex must not finish without updating the task log and appending `BUILD_LOG.md`.
Recommended checks, when available:
```bash
npm run lint
npm run typecheck
npm test
```
If a command is unavailable, record that in the task log.

## 9. Claude Code Workflow
Use Claude Code for local exploration, debugging, test-driven development, documentation updates, Markdown memory cleanup, and interactive implementation.
A Claude Code session should read required memory, inspect relevant files, update the task log with a plan, make the smallest safe change, run checks or explain skipped checks, update memory, and produce a handoff summary.
Claude Code should ask before destructive operations or changes to sensitive rules.

## 10. Scripts
Recommended helper scripts:
- `scripts/ai-task.sh` creates a task log from the standard template.
- `scripts/ai-log.sh` appends a standardized build log entry.
- `scripts/update-ai-index.mjs` refreshes `docs/ai/MEMORY_INDEX.md` from task and ADR files.
Example usage:
```bash
scripts/ai-task.sh TASK-0004 create-request-model codex
scripts/ai-log.sh TASK-0004 codex "Created initial request model and migration"
npm run ai:index
```
Scripts support logging consistency, but they do not replace human review.

## 11. PR Requirements
Every PR should include:
- task ID
- summary
- files changed
- tests run
- memory files updated
- screenshots, if UI changed
- known risks
- follow-up work
PRs should show that `docs/ai/tasks/...`, `docs/ai/BUILD_LOG.md`, and `docs/ai/MEMORY_INDEX.md` were updated when required.
Do not merge product behavior changes without checking the relevant `docs/product/` file and tests.

## 12. Commit Guidance
Use task IDs in commit messages.
Examples:
```text
TASK-0004 add request model
TASK-0007 implement approval state machine
TASK-0024 add Monday payload generator
```
Prefer concise commits tied to one task. Include AI co-author metadata only according to team policy.

## 13. Review Checklist
Before accepting AI-generated work, reviewers should check:
- Does the change match the task scope?
- Did the agent update the task log and `BUILD_LOG.md`?
- Did the agent update `MEMORY_INDEX.md` if needed?
- Were tests or checks run, or were skipped checks explained?
- Did the change modify product rules unexpectedly?
- Did the change introduce secrets?
- Were open questions and follow-ups documented?
Review especially carefully when changes touch workflow, approval, provisioning, permissions, integrations, AI behavior, or database migrations.

## 14. Guardrails
Agents must ask before deleting files, changing auth, changing approval gates, changing workflow transitions, changing project type routing, changing distribution mode behavior, changing provisioning idempotency or retry behavior, adding external write permissions, making destructive database changes, or touching production configuration, CI/CD secrets, or deployment infrastructure.
Agents may proceed without additional approval for tests, documentation, task logs, local scaffolding, and small non-breaking refactors inside the assigned task.
Never commit secrets, bypass product rules, or remove durable memory without explicit instruction.

## 15. Handoff Workflows
For Codex to Claude Code handoff:
1. Claude Code reads the task log, build log, `AGENTS.md`, and `CLAUDE.md`.
2. Claude Code inspects changed files.
3. Claude Code runs relevant checks.
4. Claude Code records review findings in the task log.
5. Claude Code appends a build log review entry.
For Claude Code to Codex handoff:
1. Codex reads the prepared task log and implementation plan.
2. Codex implements only the scoped work.
3. Codex updates the task log and build log.
4. Codex runs checks and summarizes the PR.
Handoffs should prioritize clarity over length.

## 16. Setup Checklist
Before using Codex or Claude Code on this repo:
- clone the repo
- install dependencies
- copy `.env.example` to `.env.local`
- confirm no production secrets are present
- read `AGENTS.md`, `CLAUDE.md`, and required memory files
- run baseline checks
- create a task branch
- create or update the task log
Example:
```bash
git checkout -b feature/TASK-0004-request-model
scripts/ai-task.sh TASK-0004 create-request-model human
npm install
npm run typecheck
npm test
```

## 17. Build Completion Definition
The AI-assisted build process is working when:
- every task has a task log
- `BUILD_LOG.md` shows chronological history
- `MEMORY_INDEX.md` tells a new agent where to start
- `PROJECT_MEMORY.md` summarizes current system state
- ADRs explain major decisions
- PRs include required memory updates
- agents can resume from repository memory without relying on chat history
- product behavior is defined in `docs/product/`, not duplicated in this guide
Final operating rule: Codex and Claude Code may build, but humans approve scope, product behavior, architecture, and production-impacting decisions.

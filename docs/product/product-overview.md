# Product Overview

## Product Name

Digital Solutions Project Intake OS

## One-Line Definition

An internal pre-distribution control plane that captures discovery outputs, generates AI-assisted evaluations, routes projects through human approval gates, and distributes approved work to Monday and GitHub.

## Core Operating Principle

The app owns the boundary.

Monday and GitHub distribute the work.

Developers own implementation.

## Why This Exists

The system exists to make project intake, evaluation, approval, provisioning, and handoff traceable and controlled.

It should prevent work from being distributed before review, preserve audit history, and give DevOps and downstream developers a clear handoff package.

## Primary Users

- Request Creator
- Intake Owner
- DevOps Lead
- Developer
- Admin

## System Responsibilities

The app owns:

- intake requests
- discovery notes and attachments
- AI-assisted evaluations
- clarification workflows
- approval records
- distribution packages
- provisioning history
- audit logs
- lightweight post-distribution status

## Downstream Responsibilities

Monday and GitHub are execution destinations.

Monday may receive project summaries, epics, stories, subtasks, dependencies, and operational metadata depending on the distribution mode.

GitHub may receive repositories, labels, README files, milestones, issue templates, and initial issues when custom code is required.

## AI Responsibilities

AI may help normalize intake, generate evaluations, identify risks, estimate effort, create work breakdowns, and draft handoff materials.

AI does not approve projects.

Humans retain approval authority.

## Approval Philosophy

No project should be distributed until the required human approval gates are complete.

Approval records should be preserved and should not be casually modified after completion.

## Distribution Philosophy

The app is the pre-distribution control plane.

It should package and provision approved work, but it should not become a deep bidirectional sync engine for every downstream Monday or GitHub update.

## Product Boundaries Agents Must Preserve

Agents must preserve the boundary between intake governance and downstream execution.

The app should make approved work clear, traceable, and provisionable. It should not take over every delivery workflow after handoff.

Agents must not weaken approval gates, bypass review, mutate completed approval history casually, create duplicate downstream resources during retries, or treat AI-generated recommendations as final decisions.

## Major Modules

The system is expected to include these major modules:

- intake
- workflow state machine
- AI evaluation and orchestration
- clarification
- approval
- project type registry
- distribution package generation
- Monday integration
- GitHub integration
- provisioning and retry handling
- permissions and ownership
- audit logging
- AI cost governance
- admin configuration
- lightweight post-distribution lifecycle tracking

## Non-Goals

This system should not:

- replace human approval
- continuously mirror every GitHub issue update
- continuously mirror every Monday field update
- let agents bypass approval gates
- make undocumented architecture decisions
- store secrets in the repository
- treat AI-generated recommendations as final decisions
- become a full project management replacement
- standardize every developer implementation workflow

## Product Specification Map

Detailed rules live in:

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

Agents must read this overview before touching product behavior, then read the detailed spec files for the specific behavior being changed.

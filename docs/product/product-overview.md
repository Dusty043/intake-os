# Product Overview

## Product Name

Digital Solutions Project Intake OS

## One-Line Definition

An internal Discovery workspace that turns the best available project evidence into a complete, downloadable Phase 0 planning packet.

## Core Operating Principle

Discovery owns the planning boundary.

The Phase 0 packet prepares implementation; it does not approve or provision it.

Developers own implementation.

## Why This Exists

The system exists to turn one Discovery conversation into traceable, implementation-ready planning material when no further requester information is available.

It preserves evidence, exposes assumptions, runs a full multi-agent evaluation, and gives delivery teams a portable Phase 0 document set.

## Primary Users

- Request Creator
- Intake Owner
- DevOps Lead
- Developer
- Admin

## System Responsibilities

The app owns:

- discovery sessions and frozen source snapshots
- AI-assisted evaluations
- visible assumptions and unresolved risks
- Phase 0 packets and ZIP exports
- legacy approval and provisioning history for compatibility
- audit logs
- lightweight post-distribution status

## Downstream Responsibilities

No downstream execution system is written by the active product flow. Monday and GitHub integrations remain disabled legacy capabilities.

## AI Responsibilities

AI may normalize Discovery evidence, generate evaluations, identify risks, estimate effort, create work breakdowns, and draft the complete Phase 0 packet.

AI does not approve projects.

Humans retain approval authority.

## Approval Philosophy

Phase 0 ZIP export requires no approval because it creates no external resource and is explicitly marked as unapproved planning material.

Any future external distribution still requires the existing human approval gates.

Approval records should be preserved and should not be casually modified after completion.

## Distribution Philosophy

The app packages planning work for download. It does not provision or synchronize downstream execution systems in the active product mode.

## Product Boundaries Agents Must Preserve

Agents must preserve the boundary between unapproved Phase 0 planning material and downstream implementation.

The app should make evidence, assumptions, risks, and implementation plans clear and portable. It must not present generated documents as approved decisions or create downstream resources.

Agents must not weaken approval gates, bypass review, mutate completed approval history casually, create duplicate downstream resources during retries, or treat AI-generated recommendations as final decisions.

## Major Modules

The system is expected to include these major modules:

- discovery conversation and proposal
- Phase 0 packet state machine
- AI evaluation and orchestration
- assumption and confidence tracking
- deterministic document and ZIP generation
- project type registry
- permissions and ownership
- audit logging
- AI cost governance
- admin configuration
- legacy intake, approval, provisioning, and lifecycle compatibility

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

# R&D Pack — Project Intake OS

This folder captures the R&D sprint for the full Project Intake OS. The current external brief is treated as the first validated workflow, not as the whole product.

## R&D Objective

Prove that the Project Intake OS can turn messy project inquiries into reviewable, structured project packages while preserving human governance before Monday, GitHub, or infrastructure actions are executed.

## Current Build Baseline

As of TASK-0005:

- Domain workflow, permissions, project type registry, repository naming, and dry-run provisioning logic exist.
- Framework-neutral application service exists.
- NestJS API source exists under `apps/api`.
- Prisma/Postgres schema exists under `apps/api/prisma`.
- Swagger setup exists at `/docs` once the API is installed and running.
- A schema-backed mock analysis draft module exists in `src/application/intake-analysis.ts`.
- The mock analysis path persists draft JSON on the intake snapshot and exposes `POST /intakes/:id/analysis-drafts/mock` in the NestJS controller source.
- Core tests pass locally without npm dependency installation.
- Full NestJS/Prisma API build still requires `npm install`, package lock generation, Prisma generation, and Docker smoke testing.

## R&D Deliverables

1. Technical approach memo
2. Input trigger strategy
3. AI analysis schema
4. Architecture and data-flow decision
5. Feasibility analysis
6. Cost estimate
7. Compliance and retention posture
8. Roster API mapping
9. Monday board mapping
10. Distribution rules
11. MVP implementation plan

## Recommended Direction

Build the OS as the source of truth:

```text
source input -> Project Intake OS -> AI draft analysis -> human review -> approval gates -> distribution preview -> downstream execution
```

External systems such as Google Chat, email, Monday, GitHub, roster APIs, and future infrastructure providers are adapters/data providers/execution targets. They do not own the intake lifecycle.

n8n is intentionally excluded as an orchestration or plumbing layer. The OS owns source normalization, workflow state, retries, audit logs, and integration behavior directly.

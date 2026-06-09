# Project Intake OS

Internal pre-distribution control plane for Digital Solutions project intake, AI-assisted analysis drafts, approval, dry-run provisioning, and controlled handoff to downstream tools.

## Current build state

This repository now contains the MVP/POC slices through **TASK-0005**:

1. **Iteration 1 — domain foundation**
   - canonical workflow state transitions
   - approval/provisioning workflow guards
   - role and permission helpers
   - project type registry defaults
   - repository naming, validation, labels, and README generation helpers

2. **Iteration 2 — no-AI runtime foundation**
   - framework-neutral intake workflow service
   - in-memory persistence adapter for tests/demo
   - durable audit trail contract
   - dry-run provisioning plan generator
   - Bitrix24 payload normalization seam
   - MVP demo script and lifecycle tests

3. **Iteration 2.1 — Dockerized NestJS API foundation**
   - real NestJS module/controller layout under `apps/api`
   - Prisma-backed `ProjectIntakeStore` adapter for Postgres
   - Swagger/OpenAPI at `/docs`
   - Dockerfile and Docker Compose for API + Postgres
   - HTTP endpoints for intakes, discovery, approvals, dry-run provisioning, audit, and Bitrix24 intake creation

4. **TASK-0005 — mock AI analysis draft module**
   - schema-backed `IntakeAnalysisDraft` v1 contract
   - deterministic mock analysis provider
   - draft validation helper
   - persisted `analysisDrafts` and `latestAnalysisDraft` JSON on intake records
   - `POST /intakes/:id/analysis-drafts/mock` NestJS controller source
   - demo script for the analysis draft path
   - tests proving draft-only behavior and approval/provisioning guards

Live AI provider calls, live GitHub/Monday writes, live Bitrix24 webhook sync, Google SSO/RBAC, queues, Next.js UI, and production deployment are intentionally deferred.

n8n is intentionally excluded from Project Intake OS orchestration. The app owns source normalization, workflow state, retries, audit logs, and integration behavior directly.

## Local core verification

These commands verify the dependency-free core slice and do not require third-party packages to be installed in this environment:

```bash
npm run typecheck
npm test
npm run check
npm run demo:mvp
npm run demo:analysis
npm run ai:index
```

## Dockerized API path

Once npm package installation is available, install dependencies and start the API with Postgres:

```bash
npm install
npm run api:prisma:generate
npm run api:db:push
npm run api:build
npm run api:docker:up
```

Then open:

```text
http://localhost:3000/docs
```

Health check:

```text
GET http://localhost:3000/health
```

The POC uses actor headers instead of SSO:

```text
x-actor-id: user-devops
x-actor-role: devops_lead
x-actor-name: DevOps Lead
```

Canonical roles:

```text
request_creator
intake_owner
devops_lead
developer
admin
```

## Demo flows

No-AI MVP flow:

```text
create intake
submit intake
complete discovery
record Gate 1 approval
record Gate 2 approval
generate dry-run provisioning plan
mark plan ready for provisioning
view audit trail
preview/create intake from Bitrix24-shaped payload
```

Mock analysis draft flow:

```text
create intake
submit intake
generate mock analysis draft
enter intake review
verify zero approvals
verify no provisioning plan
view audit trail
```

## Repository map

```text
src/domain/                  Framework-neutral domain logic
src/application/             Workflow services, store contracts, analysis draft module, Bitrix24 adapter, dry-run plans
apps/api/src/                Real NestJS API layer
apps/api/prisma/             Prisma/Postgres schema
apps/api/Dockerfile          API container image
Docker Compose               Local API + Postgres runtime
docs/api/                    HTTP endpoint contract
docs/deployment/             Local/container deployment notes
docs/product/                Product behavior source of truth
docs/ai/                     Durable build memory, sequence log, task logs, and ADRs
tests/                       Node test runner tests against compiled core output
scripts/                     Demo and AI index utilities
```

## Product principle

The app owns the lifecycle and audit trail. Bitrix24, Monday, GitHub, Google Chat, email, roster APIs, and future tools are channels/adapters/execution targets — not the source of truth.

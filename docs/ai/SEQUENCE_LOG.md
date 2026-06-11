# Project Intake OS Sequence Log

This log captures the agreed build sequence and current execution status. It is intentionally separate from the build log so future AI/code agents can quickly recover the roadmap.

## Agreed MVP/POC boundary

Build through Iteration 2 without the AI layer:

```text
intake -> discovery -> approvals -> dry-run provisioning plan -> ready marker -> audit trail
```

No live downstream writes. No autonomous agents. No SSO yet.

## Iteration sequence

### Iteration 1 — Domain foundation

Status: implemented and tested.

Purpose:

```text
Define what is allowed before building any runtime or integration layer.
```

Completed:

- workflow state machine
- approval/provisioning guards
- role permissions
- project type registry
- repository naming and validation
- domain tests

### Iteration 2 — No-AI runtime foundation

Status: implemented and tested.

Purpose:

```text
Turn domain rules into a usable application service with a durable contract.
```

Completed:

- framework-neutral workflow service
- in-memory store for tests/demo
- audit event contract
- dry-run provisioning plan generator
- Bitrix24 normalizer seam
- API contract docs
- MVP demo script

### Iteration 2.1 — Dockerized NestJS API with Prisma/Postgres/Swagger

Status: implemented as source files; core tests verified in this environment. Full API build requires npm dependency installation.

Purpose:

```text
Make the no-AI MVP demoable over HTTP with durable Postgres persistence.
```

Completed:

- NestJS app/module/controller structure under `apps/api`
- Prisma schema for Postgres
- Prisma-backed `ProjectIntakeStore`
- Swagger setup at `/docs`
- health endpoint at `/health`
- Dockerfile and Docker Compose runtime
- POC actor headers
- docs updated for local Docker flow

Verification done here:

```bash
npm run check
npm run demo:mvp
```

Deferred verification:

```bash
npm install
npm run api:build
npm run api:docker:up
```

Reason: package fetching was unavailable in the current execution environment.

### Iteration 2.2 — Demo polish

Status: next recommended sequence.

Target scope:

- seed/demo script that drives the HTTP API
- curl collection or Postman collection
- Swagger examples for each actor role
- basic API smoke tests once dependencies are installed
- lockfile after npm install
- reviewed Prisma migration instead of `db push`

### Iteration 3 — Next.js internal dashboard

Status: deferred.

Target scope:

- intake list/detail pages
- action buttons for submit/discovery/approval/provisioning-ready
- audit timeline
- dry-run provisioning plan viewer
- Bitrix24 payload preview/create screen

### Iteration 4 — GitHub/Monday live integration gates

Status: deferred.

Target scope:

- convert dry-run actions into executable jobs only after human approval
- idempotency and external link recording
- secrets handling
- retry/failure handling

### Iteration 5 — Bitrix24 live intake/webhook integration

Status: deferred.

Target scope:

- incoming Bitrix24 webhook intake creation
- outbound status comments/updates
- scoped credential model
- webhook signature/security review if available

### Iteration 6 — AI planning/agent loop

Status: explicitly out of MVP/POC.

Target scope:

- AI-assisted classification and discovery drafting
- multi-agent review loop
- cost governance
- explainable agent runs and audit trail integration

### Iteration 2.2 — R&D realignment for AI intake analysis

Status: added as the next recommended sequence after repository inspection.

Purpose:

```text
Keep the full Project Intake OS direction while using the new intake-automation brief as the first validation workflow.
```

Added R&D artifacts:

- input trigger strategy
- intake analysis schema draft
- distribution rules
- roster API mapping
- Monday mapping
- compliance and retention posture
- feasibility analysis
- cost estimate
- R&D decision memo

Next recommended implementation task:

```text
TASK-0005 — implement mock AI analysis draft module.
```

Target scope:

- schema-first AI analysis contract
- mock provider only
- persisted analysis draft JSON
- review-only semantics
- no live AI provider
- no live downstream writes


### TASK-0005 — Mock AI analysis draft module

Status: implemented and tested.

Purpose:

```text
Add the first AI-layer build slice without introducing live AI calls or bypassing human governance.
```

Completed:

- schema-backed `IntakeAnalysisDraft` v1 contract
- deterministic mock analysis provider
- validator for draft shape and guardrails
- persisted draft JSON on intake records
- API source endpoint `POST /intakes/:id/analysis-drafts/mock`
- tests proving generated analysis is draft-only
- demo script for analysis draft flow
- ADR excluding n8n from OS orchestration

Verification done here:

```bash
npm run check
npm run demo:analysis
```

Next recommended sequence:

```text
TASK-0006 — Analysis review acceptance/editing contract
```

Target scope:

- accept/reject/supersede analysis draft statuses
- reviewer notes and immutable generated draft preservation
- human-reviewed project package
- approval gates continue to own authorization

### TASK-0012 — Private server runtime deployment

Status: implemented.

Purpose:

```text
Make Project Intake OS run cleanly on a private server without a domain, HTTPS, or public
internet exposure. Server-first baseline: Docker Compose, local proxy, seed, smoke, backup.
```

Completed:

- `Dockerfile.api` — production API image, prisma migrate deploy on startup
- `Dockerfile.web` — Next.js image with NEXT_PUBLIC_API_BASE_URL baked in at build time
- `docker-compose.server.yml` — postgres, api, web, local-proxy (Caddy on 127.0.0.1:8080)
- `.env.server.example`
- `deploy/` — Caddyfile, deploy/healthcheck/backup/restore scripts, Tailscale notes
- `server:*` npm scripts and `seed:demo:server` for container use
- `.gitignore` updated for .env.server, backups/, *.sql, *.dump, apps/web/.next/
- `docs/deployment/private-server-runtime.md`

Key constraints:
- Host port 3001 reserved for Uptime Kuma — web container uses `expose:` only
- Local proxy binds 127.0.0.1:8080
- NEXT_PUBLIC_API_BASE_URL=/api (baked into web build; rebuild required if changed)
- SSH tunnel is default access mode; Tailscale Serve is optional; Funnel is demo-only

Next recommended choices:

```text
TASK-0013 — Google SSO / internal authentication
TASK-0013 — Real AI provider adapter
```

If public demos are needed soon, auth should come before real AI.

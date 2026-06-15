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

Next: TASK-0013 — authenticated internal access.

---

## TASK-0013 — Authenticated Internal Access & Role Resolution (2026-06-12)

Implemented:
- `AUTH_MODE=dev_headers|google` env switch
- Google OAuth/OIDC login flow: `/auth/google/start` → `/auth/google/callback`
- `AuthUser` and `AuthSession` Prisma models (db push applied on container startup)
- Server-side sessions: 32-byte random token, SHA-256 hashed before Postgres storage
- `intake_os_session` HttpOnly cookie (not localStorage)
- Global `AuthGuard`: dev_headers mode trusts headers, google mode validates session cookie
- `@Public()` on health and auth endpoints; `@CurrentActor()` on intake routes
- Role resolver: env-based (AUTH_ADMIN_EMAILS, AUTH_INTAKE_OWNER_EMAILS, etc.)
- Frontend: `/login` page, `AuthProvider`, `UserMenu`, `AuthGate`, `ClientLayout`
- Actor selector hidden in google mode; UserMenu shows name/email/role/logout
- `NEXT_PUBLIC_AUTH_MODE` build arg wired into Dockerfile.web and docker-compose.server.yml
- All 73 existing tests pass; 19 new auth tests pass

Key design:
- All existing demos/tests work unchanged in `AUTH_MODE=dev_headers`
- `toDomainActor()` bridge in intake.controller keeps workflow service interface stable
- Auth guard is global via `APP_GUARD` in AuthModule — no per-route guard noise
- Cookie: HttpOnly, SameSite=Lax, Secure configurable (false for SSH tunnel, true for HTTPS)

Files added:
- `apps/api/src/modules/auth/` (8 files)
- `apps/web/src/components/AuthProvider.tsx`, `UserMenu.tsx`, `AuthGate.tsx`, `ClientLayout.tsx`
- `apps/web/src/lib/auth-client.ts`
- `apps/web/src/app/login/page.tsx`
- `tests/auth-role-resolution.test.mjs`, `auth-actor-resolution.test.mjs`, `auth-session.test.mjs`
- `docs/ai/tasks/TASK-0013-authenticated-internal-access.md`

Next: TASK-0014 — guided AI draft regeneration

---

## TASK-0014 — Guided AI Draft Regeneration (2026-06-12)

Implemented:
- New permission `steer_analysis_draft` — granted to `intake_owner`, `devops_lead`, `admin`
- `RegenerateAnalysisDraftInput` interface + `analysisDraftRegenerationCount` on `ProjectIntakeRecord`
- `ConflictError` error class → maps to HTTP 409 in exception filter
- `regenerateAnalysisDraft()` service method with guards: permission, status, pending draft, regen limit (5)
- Mock provider incorporates guidance: scope note + deterministic story point bias
- Audit event `ANALYSIS_DRAFT_REGENERATED` with `guidance` (≤500 chars), `regenerationCount`, `requestedBy`
- `POST /intakes/:id/analysis-drafts/regenerate` endpoint with `RegenerateAnalysisDraftDto` (@MinLength(10))
- 10 new tests in `tests/guided-draft-regeneration.test.mjs` — all pass
- Demo script `scripts/demo-guided-regeneration.mjs` — full v1→v2→v3→accept→Gate1 flow

Verification:
- `npm run check` — 83/83 pass
- `npm run api:build` — PASS
- `npm run demo:guided-regen` — PASS

Next: TASK-0015 — real AI provider integration (guidance field maps directly onto prompt)

---

## TASK-0021 — Web Evaluation Review Experience (2026-06-16)

Implemented:
- `IntakeWorkflowService` read methods: `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluationForIntake`
- `EvaluationSummaryDto`, `toEvaluationSummaryDto()` in `apps/api/src/modules/intake/dto/evaluation.dto.ts`
- API routes: `GET /intakes/:id/evaluations`, `GET /intakes/:id/evaluations/latest`, `GET /intakes/:id/evaluations/:evaluationId`
- `EvaluationSectionKind`, `QualityScore`, `IntakeEvaluation`, `AgentRun`, `EvaluationSummary` types in `apps/web/src/lib/types.ts`
- `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluation` API client functions
- `EvaluationSectionCard.tsx` — 12 section-kind renderers + `AgentProvenanceFooter` + `EvaluationSectionTabs`
- `EvaluationPanel.tsx` — `QualityScoreBadge`, `QualityScoreBreakdown`, `EvaluationRegenerateForm`, `EvaluationEmptyState`
- "Evaluation" tab added to intake detail page; loads evaluation on page mount and after regen/resubmit
- `ClarificationPanel` polished: prior answers shown, required/optional grouping, inline validation, submit disabled for empty required, success/error state
- `tests/evaluation-api-read.test.mjs` — 8 tests; all pass (398/398 total)

Files:
- `src/application/intake-workflow-service.ts` (3 new read methods)
- `apps/api/src/modules/intake/dto/evaluation.dto.ts` (new)
- `apps/api/src/modules/intake/intake.controller.ts` (3 new GET routes)
- `apps/web/src/lib/types.ts` (evaluation types)
- `apps/web/src/lib/api-client.ts` (3 new client functions)
- `apps/web/src/components/EvaluationSectionCard.tsx` (new)
- `apps/web/src/components/EvaluationPanel.tsx` (new)
- `apps/web/src/app/intakes/[id]/page.tsx` (Evaluation tab + ClarificationPanel polish)
- `tests/evaluation-api-read.test.mjs` (new)
- `docs/ai/tasks/TASK-0021-web-evaluation-review-experience.md` (new)

Verification:
- `npm run check` — 398/398 pass
- `npm run api:build` — PASS
- `npm run web:build` — PASS (required fixing 27+ `!!` casts for `Record<string,unknown>` in JSX)

Next: TASK-0022 — Prisma-backed evaluation persistence (Postgres) or UI hardening

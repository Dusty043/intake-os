# Build Log

## 2026-06-12 — TASK-0013 authenticated internal access & role resolution

Requested: replace the actor-header shim with real authenticated access, add Google OAuth, preserve dev mode.

Context: TASK-0012 deployed the server stack. Auth was next before any downstream integrations or live keys.

Changes made:
- Added `AuthUser` and `AuthSession` Prisma models (server-side sessions, hashed tokens).
- Added full NestJS auth module: `role-resolver`, `session.service`, `google-auth.service`, `auth.service`, `auth.guard`, `auth.decorators`, `auth.controller`, `auth.module`.
- Global `AuthGuard` with dual mode: `dev_headers` (headers) and `google` (session cookie).
- Health and `/auth/*` routes marked `@Public()`. Bitrix24 webhook also `@Public()`.
- `@CurrentActor()` decorator replaces header bag in all intake controller methods.
- `intake.controller.ts` now passes `toDomainActor(actor)` to workflow service.
- Added `cookie-parser` middleware; CORS updated to allow credentials from `WEB_ORIGIN`.
- Frontend: `AuthProvider`, `UserMenu`, `AuthGate`, `ClientLayout`, `/login` page.
- `AppShell` shows `UserMenu` (google mode) or `ActorSelector` (dev mode).
- `api-client.ts` uses `credentials: include` + conditional actor headers.
- `NEXT_PUBLIC_AUTH_MODE` build arg wired into `Dockerfile.web` and `docker-compose.server.yml`.
- Auth env vars added to `.env.example` and `.env.server.example`.
- New tests: `auth-role-resolution` (11), `auth-session` (8), `auth-actor-resolution`.

Verification:
- `npm run check` — PASS (73/73)
- `npm run api:build` — PASS
- `npm run web:build` — PASS
- `npm run prisma:generate` — PASS
- All demos — PASS
- New auth tests — PASS (19/19)

Next: TASK-0014 — guided AI draft regeneration (now safe with real actor attribution)

## 2026-06-11 — TASK-0012 private server runtime deployment

Requested: make the project deployable on a private server without a domain, HTTPS, or public exposure.

Context: server already runs Uptime Kuma on host port 3001. App still uses actor header shims.

Changes made:
- Added `Dockerfile.api` (root) — production-grade multistage build, `prisma migrate deploy` on startup.
- Added `Dockerfile.web` (root) — Next.js multistage build, `NEXT_PUBLIC_API_BASE_URL` baked in as ARG.
- Added `docker-compose.server.yml` — postgres (127.0.0.1:5432), api (expose only), web (expose only, no host port 3001), local-proxy (127.0.0.1:8080 via Caddy).
- Added `.env.server.example` with documented variables.
- Added `deploy/Caddyfile.server` — routes /api/* to api:3000, everything else to web:3001.
- Added `deploy/Caddyfile.funnel.example` — basic auth example for Tailscale Funnel demo mode.
- Added `deploy/deploy-server.sh`, `healthcheck-server.sh`, `backup-postgres.sh`, `restore-postgres.sh` (all executable).
- Added `deploy/tailscale-serve-notes.md`, `deploy/tailscale-funnel-notes.md`.
- Added `server:build`, `server:up`, `server:down`, `server:ps`, `server:logs`, `server:health`, `server:deploy`, `server:backup` scripts to `package.json`.
- Added `seed:demo:server` script (no `--env-file=.env` for container use where env comes from docker-compose).
- Updated `.gitignore`: `.env.server`, `backups/`, `*.sql`, `*.dump`, `apps/web/.next/`.
- Added `docs/deployment/private-server-runtime.md`.
- Created task log `docs/ai/tasks/TASK-0012-private-server-runtime-deployment.md`.
- Updated `docs/ai/MEMORY_INDEX.md`, `docs/ai/SEQUENCE_LOG.md`.

Key decisions:
- Host port 3001 remains reserved for Uptime Kuma. Web container uses `expose:` not `ports:`.
- Local proxy binds to `127.0.0.1:8080` only — SSH tunnel is default access.
- NEXT_PUBLIC_API_BASE_URL=/api for proxy mode. Rebuild web image if changed.
- Tailscale Serve is optional private mode; Funnel is optional temporary demo mode only.

Commands run:

```bash
npm run check           # pass
npm run api:build       # pass
npm run web:build       # pass
npm run prisma:generate # pass
npm run demo:mvp        # pass
npm run demo:analysis   # pass
npm run demo:analysis-review  # pass
npm run demo:review-guard     # pass
npm run demo:reviewed-distribution # pass
```

Server stack verification (Docker required on server):

```bash
cp .env.server.example .env.server
npm run server:build && npm run server:up && npm run server:ps && npm run server:health
```

## 2026-06-10 — TASK-0011 end-to-end runtime smoke & seeded demo data

Requested: make the project easy to seed, demo, smoke-test, and pause cleanly.

Baseline confirmed: 49/49 tests, api:build, web:build, prisma:generate, all 5 demos passing before implementation.

Changes made:
- Added `scripts/seed-demo-data.mjs` — seeds 6 demo intakes into Postgres via application service + inline Prisma store. Idempotent: deletes records where `requester = "demo.requester@local"` before recreating.
- Added `scripts/smoke-runtime-workflow.mjs` — 8-phase governance smoke test against live API: infrastructure, CRUD, submission, AI draft, human review, Gate 1, Gate 2, distribution preview, audit trail. Hard assertions on `source.type = reviewed_project_package` and all `dryRun = true`.
- Added `npm run seed:demo`, `npm run smoke:runtime`, `npm run db:reset:demo` scripts to root `package.json`.
- Updated `README.md`: build state to TASK-0011, Seeded Demo Data section with table of 6 intakes, updated browser walkthrough to use seeded records, new scripts in reference table.
- Created task log `docs/ai/tasks/TASK-0011-end-to-end-runtime-smoke-and-seeded-demo-data.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Seeded demo records:
1. Payment Failure Notification Fix → draft
2. Marketing Dashboard Request → submitted
3. Customer Portal Enhancement → intake_review (AI draft, no reviewed package)
4. Internal SSO Management Tool → intake_review (reviewed package ready)
5. Data Pipeline Migration → devops_review (Gate 1 approved)
6. Project Intake OS UI Buildout → approved + provisioning plan

Commands run:

```bash
npm run check           # 49/49 pass (unchanged)
npm run api:build       # pass
npm run web:build       # pass
npm run prisma:generate # pass
npm run demo:analysis   # pass
npm run demo:analysis-review   # pass
npm run demo:review-guard      # pass
npm run demo:reviewed-distribution  # pass
npm run demo:mvp        # pass
```

Live runtime verification (requires Docker/Postgres):
```bash
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo           # seeds 6 demo intakes
npm run api:start:dev
npm run smoke:api           # quick health/CRUD
npm run smoke:runtime       # full governance flow
npm run web:dev             # open http://localhost:3001/intakes
```

Result: seed script, runtime smoke, and docs are complete. This is a clean pause point.

## 2026-06-10 — TASK-0010 minimal Next.js review UI

Requested: build the first browser-operable interface for Project Intake OS.

Baseline confirmed: 49/49 tests, api:build, all demos passing before implementation.

Changes made:
- Created `apps/web` as a Next.js 15 App Router + TypeScript + Tailwind CSS v3 application.
- Dark sidebar AppShell with actor selector; actor persists to localStorage.
- Preconfigured actors: Request Creator, Intake Owner, DevOps Lead, Admin, Developer.
- API client with actor headers, readable error surfacing, all workflow endpoints.
- `/intakes` — intake list table with status badges, links, create/refresh.
- `/intakes/new` — create intake form with workflow preview banner.
- `/intakes/[id]` — detail page with 7 tabs: Overview, AI Draft, Reviewed Package, Approvals, Distribution, Audit Trail, Debug.
- Governance visible: Gate 1/2 guards shown in UI, dry-run notice on Distribution, AI notice on AI Draft, reviewed package source-of-truth banner.
- Added `web:dev`, `web:build`, `web:start` scripts to root `package.json`.
- Added `NEXT_PUBLIC_API_BASE_URL` to `.env.example` and `apps/web/.env.local.example`.
- Task log `docs/ai/tasks/TASK-0010-minimal-nextjs-review-ui.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm install --prefix apps/web     # pass
npm run web:build                  # pass (6 routes)
npm run check                      # 49/49 pass (unchanged)
npm run api:build                  # pass
npm run demo:analysis              # pass
npm run demo:analysis-review       # pass
npm run demo:review-guard          # pass
npm run demo:reviewed-distribution # pass
npm run demo:mvp                   # pass
```

Live stack smoke test (requires running Docker/Postgres/API):
```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run api:start:dev
npm run web:dev
# Open http://localhost:3001 and follow manual walkthrough
```

Result: Next.js UI is buildable and ready for manual browser walkthrough once the stack is running.

## 2026-06-10 — TASK-0009 API runtime & dependency stabilization

Requested: make the NestJS/Prisma/Postgres runtime reliably installable, buildable, and locally runnable.

Baseline confirmed: 49/49 tests passing, api:build passing before implementation.

Changes made:
- Split health controller: `GET /health` is a liveness check (no DB dependency); `GET /health/db` is a readiness check (Postgres query).
- Added npm scripts: `prisma:generate`, `prisma:migrate`, `prisma:migrate:deploy`, `prisma:migrate:reset`, `prisma:db:push`, `prisma:studio`, `api:start:dev`, `docker:up`, `docker:down`, `smoke:api`.
- Updated `.env.example` with `NODE_ENV`, `API_PORT`, `API_HOST`, `POSTGRES_*`, `SWAGGER_*`, dual DATABASE_URL comment.
- Created `scripts/smoke-api.mjs` — tests health, Swagger, list intakes, create, submit, optional mock draft, optional DB health.
- Rewrote `README.md` with full local setup flow, script reference table, endpoint table, troubleshooting section.
- Created task log `docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm run check                      # 49/49 pass (unchanged)
npm run prisma:generate            # pass
npm run api:build                  # pass
npm run demo:analysis              # pass
npm run demo:analysis-review       # pass
npm run demo:review-guard          # pass
npm run demo:reviewed-distribution # pass
npm run demo:mvp                   # pass
```

Result: runtime is stable and documented. A clean clone can install, generate Prisma client, build the API, start Postgres, and pass smoke tests.

## 2026-06-10 — TASK-0008 distribution preview from reviewed project package

Requested: make ReviewedProjectPackage the authoritative source for dry-run provisioning/distribution preview.

Baseline confirmed: 44/44 tests passing before implementation.

Changes made:
- Added `DistributionSourceType`, `ProvisioningPlanSource` types and `source` field to `ProvisioningPlan` in `types.ts`.
- Added `resolveDistributionSource` to `provisioning-plan.ts` — returns `reviewed_project_package`, `manual_discovery`, or `legacy_intake_record`. Throws if AI drafts exist but no reviewed package.
- Added `buildIssueTitlesFromPackage` helper — uses reviewed subtask titles for GitHub initial issues.
- Updated `buildDryRunProvisioningPlan` to use reviewed package fields (projectType, subtasks, brief, estimatedStoryPoints) when present.
- Updated `generateProvisioningPlan` audit metadata to include `sourceType` and `sourceId`.
- Added `tests/distribution-preview-source.test.mjs` (5 new tests).
- Added `scripts/demo-reviewed-package-distribution-preview.mjs` and `demo:reviewed-distribution` package script.
- Created task log, updated MEMORY_INDEX.

Commands run:

```bash
npm run check                      # 49/49 pass (44 original + 5 new)
npm run demo:analysis              # pass
npm run demo:analysis-review       # pass
npm run demo:review-guard          # pass
npm run demo:reviewed-distribution # pass
npm run demo:mvp                   # pass
```

Result: product boundary fully complete — distribution preview derives exclusively from human-reviewed package when one exists.

## 2026-06-10 — TASK-0007 require reviewed package before Gate 1 approval

Requested: close the governance gap from TASK-0006 — Gate 1 approval must require a ReviewedProjectPackage when AI analysis drafts exist.

Baseline confirmed: 38/38 tests passing before implementation.

Changes made:
- Added Gate 1 guard in `recordApproval`: blocks if `analysisDrafts.length > 0` and `reviewedProjectPackage` is missing.
- Updated existing test in `intake-analysis-draft.test.mjs` to accept draft before Gate 1 (now required).
- Added `tests/approval-reviewed-package-guard.test.mjs` (6 new tests).
- Added `scripts/demo-reviewed-package-approval-guard.mjs` and `demo:review-guard` package script.
- Created task log `docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm run check            # 44/44 pass (38 original + 6 new)
npm run demo:analysis    # pass
npm run demo:analysis-review  # pass
npm run demo:review-guard  # pass
npm run demo:mvp         # pass
```

Result: governance model fully enforced — AI drafts must be human-reviewed before Gate 1 approval. No-AI/manual path unchanged.

## 2026-06-10 — TASK-0006 analysis review lifecycle

Requested: implement the Analysis Review Lifecycle (TASK-0006) from the task-6-handoff.md spec.

Context read:
- `CLAUDE.md`, `BUILD_GUIDE.md`
- `docs/ai/PROJECT_MEMORY.md`, `docs/ai/MEMORY_INDEX.md`
- `docs/ai/tasks/TASK-0005-mock-ai-analysis-draft-module.md`
- `src/application/intake-analysis.ts`, `src/application/intake-workflow-service.ts`
- `src/domain/workflow.ts`, `src/domain/permissions.ts`
- `src/application/types.ts`
- `tests/intake-analysis-draft.test.mjs`

Baseline confirmed: 28/28 tests passing before implementation.

Changes made:
- Added `ReviewedProjectPackage`, `ReviewedProjectPackageInput`, `AnalysisDraftReviewDecision`, `AcceptAnalysisDraftInput`, `RejectAnalysisDraftInput`, `ReviseAnalysisDraftInput` types to `src/application/types.ts`.
- Added `reviewedProjectPackage` field to `ProjectIntakeRecord`.
- Added `review_analysis_draft` permission to `src/domain/permissions.ts` (granted to `intake_owner`, `devops_lead`, `admin`).
- Added `acceptAnalysisDraft`, `rejectAnalysisDraft`, `reviseAnalysisDraft` methods to `IntakeWorkflowService`.
- Added `requireDraft` and `requireDraftPendingReview` helpers.
- Added audit events: `ANALYSIS_DRAFT_ACCEPTED`, `ANALYSIS_DRAFT_REJECTED`, `ANALYSIS_DRAFT_REVISED`, `REVIEWED_PROJECT_PACKAGE_CREATED`.
- Added `tests/analysis-review-lifecycle.test.mjs` (10 new tests).
- Added `scripts/demo-analysis-review.mjs` and `demo:analysis-review` package script.
- Added API DTOs: `AcceptAnalysisDraftDto`, `RejectAnalysisDraftDto`, `ReviseAnalysisDraftDto`.
- Added API controller endpoints: `POST /intakes/:id/analysis-drafts/:draftId/accept|reject|revise`.
- Created task log `docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm run check         # 38/38 pass (28 original + 10 new)
npm run demo:analysis # pass
npm run demo:analysis-review  # pass
npm run demo:mvp      # pass
```

Result: all checks pass. Product boundary between AI draft and human-reviewed package is now enforced.

Follow-up:
- Optional Gate 1 guard requiring `reviewedProjectPackage` before approval.
- Prisma schema update for `reviewedProjectPackage` JSON column when DB is active.

## 2026-05-26 — TASK-0001 bootstrap domain core

Requested: start building the Project Intake OS from the uploaded repository.

Context read:

- `AGENTS.md`
- `BUILD_GUIDE.md`
- `docs/product/product-overview.md`
- `docs/product/workflow-state-machine.md`
- `docs/product/project-type-registry.md`
- `docs/product/permissions-and-ownership.md`
- `docs/product/repository-and-naming.md`
- `docs/product/requirements-trace.md`

Changes made:

- Added TypeScript package scaffolding with local scripts.
- Added framework-neutral domain modules for workflow, permissions, project type registry, and repository naming.
- Added Node test runner coverage for the implemented domain slice.
- Added durable AI memory files under `docs/ai/`.
- Added `ADR-0001` documenting the domain-first build decision.
- Updated product requirements trace statuses for implemented/tested foundation requirements.

Commands run:

```bash
npm run typecheck
npm test   # initially failed because Node was invoked against the tests directory instead of test files
npm run check
npm run ai:index
# package verification in a clean unzip
npm run check
```

Result: checks passed after implementation fixes. The packaged zip was verified from a clean unzip with `npm run check`.

Follow-up:

- Add persistence/API boundary around the domain core.
- Recreate or add missing `docs/product/distribution-rules.md` before implementing live distribution package behavior.
- Choose the monolith framework and database migration approach.

## 2026-05-27 — TASK-0002 iteration 2 no-AI MVP runtime foundation

Requested: implement the MVP/POC boundary through Iteration 2 without the AI layer.

Context decisions applied:

- Use a NestJS-ready modular monolith shape.
- Keep the verified code path dependency-free because package installation was unavailable in this environment.
- Treat Bitrix24 as an intake/source adapter, not the source of truth.
- Keep GitHub, Monday, and Bitrix24 writes as dry-run provisioning actions only.

Changes made:

- Added `src/application` service layer around the domain rules.
- Added in-memory persistence and audit trail contracts.
- Added dry-run provisioning plan generation with GitHub/Monday/docs/Bitrix24 action modeling.
- Added Bitrix24 payload normalization.
- Added `apps/api` composition root and controller shell for the future NestJS app.
- Added `apps/api/prisma/schema.prisma` as the Postgres-minded schema draft.
- Added Dockerfile and Docker Compose baseline.
- Added MVP demo script.
- Added API/deployment documentation.
- Added ADR-0002 for the portable NestJS-ready runtime decision.
- Added lifecycle and Bitrix24 tests.

Commands run:

```bash
npm run typecheck
npm test
npm run demo:mvp
```

Result: 24 tests passed. The demo reaches an approved intake with a ready dry-run provisioning plan and 9 audit events.

Follow-up:

- Install real NestJS dependencies and attach decorators/routes.
- Add Prisma client and a real Postgres-backed repository adapter.
- Add OpenAPI/Swagger once NestJS is active.
- Keep live GitHub/Monday/Bitrix24 writes disabled until a separate approval/integration task.

## 2026-05-27 — TASK-0003 Dockerized NestJS API with Prisma/Postgres/Swagger

Requested: add the agreed sequence roadmap into a log file and proceed with the Dockerized NestJS API using Prisma, Postgres, and Swagger.

Context decisions applied:

- Keep Iteration 2.1 no-AI and no-live-provisioning.
- Keep the framework-neutral domain/application core as the source of workflow truth.
- Add a real NestJS HTTP runtime under `apps/api` without breaking dependency-free core verification.
- Use Prisma/Postgres for durable intake/audit persistence.
- Use Swagger as the temporary POC operator/demo UI before building Next.js.

Changes made:

- Moved dependency-free API composition root exports into `src/application/api-composition-root.ts`.
- Added real NestJS bootstrap, modules, controllers, DTOs, actor-header handling, and exception filter under `apps/api/src`.
- Added Prisma service and `PrismaProjectIntakeStore` adapter.
- Updated `apps/api/prisma/schema.prisma` with Postgres models, `recordSnapshot`, audit indexes, and provisioning plan/action models.
- Updated `package.json` with NestJS/Prisma/Swagger dependencies and API scripts.
- Added `apps/api/tsconfig.json` and `apps/api/nest-cli.json`.
- Updated Dockerfile and Docker Compose for local API + Postgres.
- Updated `.env.example`, README, API contract, and deployment docs.
- Added `docs/ai/SEQUENCE_LOG.md` with the agreed roadmap and next sequences.
- Added `docs/ai/tasks/TASK-0003-dockerized-nestjs-api.md`.

Commands run:

```bash
npm run check
npm run demo:mvp
```

Result: 24 core tests passed and the no-AI lifecycle demo still reaches an approved intake with a ready dry-run provisioning plan.

Known constraint: full API dependency build was not verified because npm package fetching was unavailable in the execution environment. The next environment with package access should run:

```bash
npm install
npm run api:build
npm run api:docker:up
```

Follow-up:

- Generate and commit `package-lock.json` after dependencies are installed.
- Add API smoke tests against the running NestJS server.
- Replace POC `prisma db push` with reviewed migrations before production-like deployment.
- Add a Swagger/curl demo sequence for actor-specific approval flow.

## 2026-06-05 — TASK-0004 R&D realignment for AI intake analysis module

Requested: continue the R&D ourselves while preserving the full Project Intake OS direction rather than shrinking into a one-off automation.

Repository inspection findings:

- Core TypeScript build and tests passed in the current environment.
- `npm run check` passed with 24/24 tests.
- `npm run demo:mvp` reached an approved intake with a ready dry-run provisioning plan.
- NestJS/Prisma API source exists, but dependency-backed API build still requires `npm install`, Prisma generation, package-lock creation, and Docker smoke testing.

Changes made:

- Added R&D decision memo, feasibility analysis, and cost estimate under `docs/rd`.
- Added input trigger strategy, intake analysis schema draft, and distribution rules under `docs/product`.
- Added roster API and Monday mapping docs under `docs/integrations`.
- Added compliance and retention posture under `docs/security`.
- Added TASK-0004 task log.
- Updated sequence log with Iteration 2.2 and TASK-0005 recommendation.

Next recommended task:

```text
TASK-0005 — implement mock AI analysis draft module.
```

## 2026-06-09 — TASK-0005 mock AI analysis draft module

Requested: start the first real build slice after R&D realignment.

Context decisions applied:

- Keep the full Project Intake OS direction.
- Exclude n8n from OS orchestration/plumbing.
- Add AI analysis as schema-backed draft output, not as an autonomous actor.
- Keep live AI providers, Monday writes, GitHub writes, and provisioning execution disabled.

Changes made:

- Added `src/application/intake-analysis.ts` with the `IntakeAnalysisDraft` v1 contract, deterministic mock provider, and validator.
- Added `analysisDrafts` and `latestAnalysisDraft` to `ProjectIntakeRecord`.
- Added `IntakeWorkflowService.generateMockAnalysisDraft()`.
- Added framework-neutral controller support for mock analysis generation.
- Added NestJS DTO/controller source for `POST /intakes/:id/analysis-drafts/mock`.
- Added Prisma JSON fields for `analysisDrafts` and `latestAnalysisDraft`.
- Added `tests/intake-analysis-draft.test.mjs`.
- Added `scripts/demo-analysis-draft.mjs` and `npm run demo:analysis`.
- Added ADR-0003 documenting OS-owned orchestration and no n8n runtime.
- Updated R&D, product, API, and README docs.

Commands run:

```bash
npm run check
npm run demo:mvp
npm run demo:analysis
npm run api:build   # blocked: prisma CLI not installed in unpacked package
npm install         # attempted once; timed out in this environment before producing node_modules/package-lock
```

Result: 28/28 core tests passed. The mock analysis demo reaches `intake_review` with a draft analysis, zero approvals, no provisioning plan, and the expected audit sequence.

Known constraint: full API dependency build still requires package installation because the unpacked package does not include `node_modules` or a generated lockfile.

Follow-up:

- Add analysis review accept/reject/supersede actions.
- Add human-edited reviewed project package separate from the immutable generated draft.
- Add Next.js review UI after the review contract is stable.
- Add live provider integration only after compliance/provider decisions are confirmed.

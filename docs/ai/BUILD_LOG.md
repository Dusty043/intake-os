# Build Log

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

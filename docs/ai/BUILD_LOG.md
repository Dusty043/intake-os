# Build Log

## 2026-06-23 — QA Run + Frontend Role-Guard Fixes

Standard-tier QA of the running app at http://localhost:8080 (dev_headers mode).

Issues found and fixed:
- **ISSUE-001 (Medium):** Mark Plan Ready button visible to all roles — now gated to `devops_lead` and `admin`
- **ISSUE-002 (Medium):** Generate Mock AI Draft button visible to `request_creator` — now gated to roles with `generate_evaluation` permission
- **ISSUE-003 (Low/prod):** Debug tab visible to all roles — deferred; restrict before OAuth activation
- **ISSUE-004 (Low):** Approvals tab slow initial load (~3s) — deferred, non-functional
- **ISSUE-005 (Low):** Intakes table overflow on mobile — deferred, low-priority internal tool

Health score: **82/100**. No critical or high bugs. API enforces all permissions correctly throughout.

Files changed:
- `apps/web/src/app/intakes/[id]/page.tsx` — ADD `useActor()` to OverviewTab; role-guard Generate Mock AI Draft and Mark Plan Ready buttons
- `.gstack/qa-reports/qa-report-localhost-2026-06-22.md` — NEW: full QA report

Commands run:
```
npm run typecheck   # clean
```

## 2026-06-22 — TASK-0030: AI Cost Governance

Token/cost data was already flowing through AgentRun records. Wired the read side: admin usage endpoints, cost badge in evaluation panel, admin AI usage dashboard.

Files changed:
- `src/application/providers/model-cost-registry.ts` — NEW: model cost lookup with `COST_INPUT_<SLUG>` env-var overrides and built-in defaults for known models
- `src/application/types.ts` — ADD: `listAllAgentRuns()` to `ProjectIntakeStore` interface
- `src/application/in-memory-store.ts` — IMPL: `listAllAgentRuns()` with intakeId/date filters
- `apps/api/src/persistence/prisma-project-intake-store.ts` — IMPL: `listAllAgentRuns()` with Prisma join to evaluation
- `apps/api/src/modules/admin/ai-usage.controller.ts` — NEW: `GET /admin/ai-usage` and `GET /admin/ai-usage/summary`
- `apps/api/src/modules/admin/admin.module.ts` — NEW: admin module
- `apps/api/src/app.module.ts` — ADD: AdminModule
- `apps/web/src/lib/api-client.ts` — ADD: `getAiUsage()` and `getAiUsageSummary()`
- `apps/web/src/components/EvaluationPanel.tsx` — ADD: `AiCostBadge` showing estimated cost per evaluation
- `apps/web/src/app/admin/ai-usage/page.tsx` — NEW: admin AI usage dashboard with monthly summary + by-model/by-role breakdowns
- `src/index.ts` — EXPORT: token-cost and model-cost-registry
- `tests/ai-cost-governance.test.mjs` — NEW: 21 unit tests

Commands run:
```
npm run build:core && npm run api:build   # clean
npm test                                  # 504/504 pass
```

Notes:
- Model costs for the analysis providers continue to be loaded via the existing `OPENAI_INPUT_COST_PER_1M_TOKENS` / `ANTHROPIC_INPUT_COST_PER_1M_TOKENS` env vars in `analysis-provider-config.ts` — the new `model-cost-registry.ts` is a standalone utility available for other callers
- Admin endpoints require `admin` or `devops_lead` role, checked in controller

## 2026-06-22 — TASK-0029: Rate Limiting

Wired `@nestjs/throttler` with global + per-route limits and env-var overrides.

Files changed:
- `apps/api/src/config/rate-limit.config.ts` — NEW: config loader with all tier defaults and env-var overrides
- `apps/api/src/app.module.ts` — ADD: ThrottlerModule + APP_GUARD (ThrottlerGuard)
- `apps/api/src/main.ts` — ADD: `trust proxy` + `NestExpressApplication` type
- `apps/api/src/modules/intake/intake.controller.ts` — ADD: `@Throttle()` on create, mock, regenerate endpoints
- `apps/api/src/modules/health/health.controller.ts` — ADD: `@SkipThrottle()` on controller
- `tests/rate-limiting.test.mjs` — NEW: 15 unit tests for config defaults and env-var overrides

Commands run:
```
npm install @nestjs/throttler
npm run api:build       # clean
npm run build:core && npm test   # 483/483 pass
```

Notes:
- `POST /intakes/:id/generate-evaluation` does not exist yet in the controller — not throttled; will be added when the endpoint is built
- Webhook routes (TASK-0025/0026 intake sources controller) not throttled yet — placeholder noted in task doc
- Rate limits are per-IP; `trust proxy 1` enables nginx `X-Forwarded-For` passthrough on oreochiserver

## 2026-06-19 — TASK-0028: Failure and Recovery

Implemented full failure and recovery layer for the provisioning system.

Files changed:
- `src/domain/error-categories.ts` (new) — `ProvisioningErrorCategory` enum, `normalizeProvisioningError()`, `isAutoRetryable()`
- `src/application/provisioning/backoff.ts` (new) — `calculateBackoffMs()`, `sleep()`
- `src/domain/provisioning.ts` — added `errorCategory`, `deadLettered`, `deadLetteredAt` to `ProvisioningTargetResult`; `errorSummary` to `ProvisioningRun`
- `src/application/types.ts` — added `updateProvisioningTargetResult()` to `ProjectIntakeStore` interface; fixed import
- `src/application/in-memory-store.ts` — implemented `updateProvisioningTargetResult()`
- `src/application/intake-workflow-service.ts` — added `executeWithAutoRetry()` private method (wraps executor with backoff for transient errors); updated `executeDistribution()` and `retryFailedProvisioningTargets()` to use it; added dead-letter ceiling (3 attempts) with Chat notification; added `markProvisioningTargetResolved()` method
- `src/application/notifications/google-chat-notifier.ts` — added `"provisioning_dead_lettered"` event type
- `src/index.ts` — exported new modules
- `apps/api/prisma/schema.prisma` — added `errorCategory`, `deadLettered`, `deadLetteredAt` to `ProvisioningTargetResult`; `errorSummary` to `ProvisioningRun`
- `apps/api/src/persistence/prisma-project-intake-store.ts` — updated `saveProvisioningRun` to persist new fields; added `updateProvisioningTargetResult()`; updated `fromProvisioningRunRow` to map new columns
- `apps/api/src/modules/intake/dto/mark-resolved.dto.ts` (new)
- `apps/api/src/modules/intake/intake.controller.ts` — added `POST /intakes/:id/provisioning-targets/:targetId/mark-resolved`
- `apps/web/src/lib/types.ts` — updated `ProvisioningTargetResult` and `ProvisioningRun` types
- `apps/web/src/lib/api-client.ts` — added `markProvisioningTargetResolved()`
- `apps/web/src/app/admin/failures/page.tsx` (new) — admin UI listing dead-lettered targets with mark-resolved action
- `tests/provisioning-failure-recovery.test.mjs` (new) — 30 unit tests

Commands run:
```bash
npm run build:core   # clean
npm run api:build    # clean
npm test             # 468/468 pass
```

Notes: Prisma migration (`add_error_category_dead_letter`) is generated but requires DB on server to apply. Run: `npm run prisma:migrate -- --name add_error_category_dead_letter` on oreochiserver.

## 2026-06-19 — TASK-0027: Auth Hardening

Created `src/auth-config-validator.ts` — pure `validateAuthConfig()` function that crashes at startup if `NODE_ENV=production` and `AUTH_MODE` is unset or set to `dev_headers`. Exported from `src/index.ts`. Called in `apps/api/src/main.ts` before `NestFactory.create()`.

Files changed:
- `src/auth-config-validator.ts` (new) — `validateAuthConfig()`, returns `{ mode: AuthMode }`
- `src/index.ts` — added export
- `apps/api/src/main.ts` — calls validator before bootstrap, logs active auth mode
- `tests/auth-config-validator.test.mjs` (new) — 10 unit tests

Commands run:
```bash
npm run build    # clean
npm run typecheck # clean
npm test         # 438/438 pass (10 new auth-config tests)
```

## 2026-06-19 — TASK-0027 through TASK-0032: Pre-Provisioning Hardening Specs

Six task spec documents written for credential-independent hardening work. No code changes — specs only.

- `docs/ai/tasks/TASK-0027-auth-hardening.md` — CRITICAL: startup validator that prevents `AUTH_MODE=dev_headers` from running in production; rejects missing `AUTH_MODE` in production; unit tests for all cases
- `docs/ai/tasks/TASK-0028-failure-and-recovery.md` — HIGH: error category enum, dead-letter promotion logic, exponential backoff helper, manual recovery endpoint, admin failure dashboard; Prisma migration adds `errorCategory`, `deadLettered`, `maxAttempts` to `ProvisioningTargetResult`
- `docs/ai/tasks/TASK-0029-rate-limiting.md` — HIGH: `@nestjs/throttler` wiring, per-route limits for intake submission and AI triggers, env-var configurable tiers, proxy trust config
- `docs/ai/tasks/TASK-0030-ai-cost-governance.md` — HIGH: wire existing `AgentRun` token columns to actual AI provider calls using existing `estimateCost()` utility, model cost registry, admin cost read endpoints, per-evaluation cost badge in UI
- `docs/ai/tasks/TASK-0031-post-distribution-lifecycle.md` — MEDIUM: expand `RequestStatus` enum with `in_progress`, `blocked`, `completed`, `canceled`; lifecycle transition service and endpoints; distributed projects dashboard
- `docs/ai/tasks/TASK-0032-input-validation-hardening.md` — MEDIUM: `@MaxLength` on all DTO string fields, named validation constants, confirm global ValidationPipe options

Open questions added to OPEN_QUESTIONS.md for each task.

## 2026-06-19 — TASK-0024: Google Chat Notifications (Outbound)

Google Chat notifications wired to intake lifecycle events. No-op when `GOOGLE_CHAT_WEBHOOK_URL` is not set.

Changes made:

- `src/application/notifications/google-chat-notifier.ts` (new) — `GoogleChatNotifier` class, fire-and-forget POST to webhook, no-op if URL not configured
- `src/application/notifications/google-chat-config.ts` (new) — loads `GOOGLE_CHAT_WEBHOOK_URL` and `INTAKE_APP_URL` from env
- `src/index.ts` — added notifier exports
- `src/application/intake-workflow-service.ts` — added `notifier?: GoogleChatNotifier` to options; 6 notification hook points: clarification_required, intake_review (×2 paths), devops_review, distributed, provisioning_failed; private `notifyProvisioningOutcome()` helper shared by execute and retry
- `apps/api/src/runtime/runtime.module.ts` — creates `GoogleChatNotifier` from config, logs enabled/disabled status, passes to `IntakeWorkflowService`
- `tests/google-chat-notifier.test.mjs` (new) — 9 unit tests

Also written (no code, spec only):

- `docs/ai/tasks/TASK-0025-email-intake.md` — email intake spec via inbound webhook service
- `docs/ai/tasks/HANDOFF-0025-email-intake.md` — handoff doc with service options and open questions
- `docs/ai/tasks/TASK-0026-google-chat-intake.md` — Google Chat app slash command spec
- `docs/ai/tasks/HANDOFF-0026-google-chat-intake.md` — handoff doc with GCP setup steps and open questions

Commands run:

```bash
npm run typecheck   # clean
npm run build       # clean
npm test            # 428/428 pass (9 new notifier tests)
```

## 2026-06-17 — TASK-0023C: Retry Failed Provisioning Targets

Retry mechanism wired end-to-end. New run with `kind: "retry"` that only executes failed+retryable targets.

Changes made:

- `src/domain/provisioning.ts` — `kind`, `retryOfRunId` on `ProvisioningRun`; `retryable` on `ProvisioningTargetResult`
- `src/application/provisioning/provisioning-executor.ts` — `isRetry: boolean` added to `ProvisioningContext`
- `src/application/provisioning/mock-executor.ts` — retry-aware modes (`github_fail_then_succeed`, `monday_fail_then_succeed`, `both_fail_then_succeed`); per-run idempotency keys for retry targets
- `apps/api/prisma/schema.prisma` — `kind`, `retryOfRunId` on `ProvisioningRun`; `retryable` on `ProvisioningTargetResult`
- Migration: `20260617144700_add_provisioning_retry_fields`
- `src/application/intake-workflow-service.ts` — `retryFailedProvisioningTargets()` method; `executeDistribution` now sets `kind: "initial"`
- `apps/api/src/persistence/prisma-project-intake-store.ts` — persist + read `kind`, `retryOfRunId`, `retryable`
- `apps/api/src/modules/intake/dto/provisioning-run.dto.ts` — new fields in DTO + mapper
- `apps/api/src/modules/intake/intake.controller.ts` — `POST /intakes/:id/distribution/runs/:runId/retry`
- `apps/web/src/lib/types.ts` — `kind`, `retryOfRunId` on `ProvisioningRun`; `retryable` on target result
- `apps/web/src/lib/api-client.ts` — `retryProvisioningRun(id, runId, actor)`
- `apps/web/src/app/intakes/[id]/page.tsx` — retry button in `ProvisioningRunPanel`; "Approve for Execution" renamed to "Mark Plan Ready"
- `tests/provisioning-retry.test.mjs` (new) — 11 tests

Commands run:

```bash
npm run build       # clean
npm run typecheck   # clean
npm test            # 418/418 pass
```

## 2026-06-17 — TASK-0023B: Provisioning Run UI

Distribution tab now shows execution readiness, governance buttons, and run history.

Changes made:

- `apps/web/src/lib/api-client.ts` — added `markReadyForProvisioning`, `executeDistribution`, `listProvisioningRuns`
- `apps/web/src/lib/types.ts` — added `ProvisioningRun`, `ProvisioningTargetResult` types
- `apps/web/src/app/intakes/[id]/page.tsx` — rewrote `DistributionTab`: status banners, "Approve for Execution" + "Execute Distribution" governance buttons, run history panel with per-target status + external links

Commands run:

```bash
npm run typecheck   # clean
npm test            # 407/407 pass
```

## 2026-06-17 — TASK-0023A: Provisioning Execution Foundation

Built the execution slot for distribution without Monday/GitHub writes.

Changes made:

- `src/domain/provisioning.ts` (new) — `ProvisioningRun`, `ProvisioningTargetResult`, status/kind enums
- `src/application/provisioning/provisioning-executor.ts` (new) — `ProvisioningExecutor` interface + `ProvisioningRegistry`
- `src/application/provisioning/mock-executor.ts` (new) — `MockMondayExecutor`, `MockGithubExecutor`, `createMockRegistry(mode)` with 4 modes
- `apps/api/prisma/schema.prisma` — `ProvisioningRun` + `ProvisioningTargetResult` models
- Migration: `20260617135057_add_provisioning_run`
- `src/application/types.ts` — added provisioning run store methods + re-exports
- `src/application/in-memory-store.ts` — implemented `saveProvisioningRun`, `listProvisioningRuns`, `getProvisioningRun`
- `apps/api/src/persistence/prisma-project-intake-store.ts` — same methods via Prisma
- `src/application/intake-workflow-service.ts` — `executeDistribution(id, actor)` with 6 guards + full audit; `listProvisioningRuns`; `provisioningRegistry` option
- `apps/api/src/modules/intake/dto/provisioning-run.dto.ts` (new) — DTOs
- `apps/api/src/modules/intake/intake.controller.ts` — `POST /intakes/:id/distribution/execute`, `GET /intakes/:id/distribution/runs`
- `apps/api/src/runtime/runtime.module.ts` — wires mock registry; reads `PROVISIONING_EXECUTOR_MODE`
- `src/index.ts` — exports new provisioning modules
- `tests/provisioning-execution.test.mjs` (new) — 9 tests covering success, failure, partial success, all guards

Commands run:

```bash
npx prisma migrate dev --name add_provisioning_run   # applied
npm run typecheck   # clean
npm test            # 407/407 pass (was 398/398)
```

## 2026-06-16 — TASK-0022: ClarificationPanel Review Fixes + Test Infrastructure

Applied all actionable findings from the `/review` pass on the TASK-0021 diff.

Changes made:

- `apps/web/src/components/ClarificationPanel.tsx` (new) — extracted from `page.tsx`; `QuestionField` sub-component DRYs required/optional rendering; carries all prior fixes (submittingRef, useEffect reset, aria attrs, stable keys).
- `apps/web/src/components/__tests__/ClarificationPanel.test.tsx` (new) — 10 Vitest tests covering disabled state, aria attributes, blur validation, submit/success/error, double-submit guard, questions-reset, prior clarifications.
- `apps/web/vitest.config.ts` + `apps/web/vitest.setup.ts` (new) — Vitest + jsdom + @testing-library/jest-dom setup.
- `apps/web/package.json` — added vitest, @testing-library/react, user-event, jest-dom, jsdom; added `test` and `test:watch` scripts.
- `apps/web/src/lib/api-client.ts` — `approveGate()` now requires explicit `gate: "gate_1" | "gate_2"` param.
- `apps/web/src/app/intakes/[id]/page.tsx` — imports `ClarificationPanel`; `handleResubmitPanel` useCallback; gate discriminator fix.

Commands run:

```bash
npx vitest run     # 10/10 pass
npm run typecheck  # clean
git push origin main && git push simple-biz main
```

## 2026-06-16 — TASK-0021 Followup: ClarificationPanel Polish + Docs Gap-Fill

Completed remaining TASK-0021 items identified in calibration check.

Changes made:

- `apps/web/src/app/intakes/[id]/page.tsx` — `ClarificationPanel` polished: required/optional question grouping, prior answers shown, inline per-field validation (touched state), submit disabled until required fields filled, success banner after resubmit, error state if `onResubmit` throws; `onResubmit` prop changed to `Promise<void>` with error propagation.
- `docs/ai/MEMORY_INDEX.md` — added TASK-0021 task log entry.
- `docs/ai/SEQUENCE_LOG.md` — added TASK-0021 sequence log entry.
- `docs/product/requirements-trace.md` — added A-014 (ClarificationPanel polish), B-013–B-016 (evaluation read API + UI requirements).

Commands run:

```bash
npm run web:build    # clean
npm run check        # 398/398 pass
```

---

## 2026-06-16 — TASK-0021 Web UI: Evaluation Review Experience

Added read-only evaluation API routes and a full Evaluation tab in the intake detail UI.

Changes made:

- `src/application/intake-workflow-service.ts` — `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluationForIntake` service methods.
- `apps/api/src/modules/intake/dto/evaluation.dto.ts` — new `EvaluationSummaryDto` + mapper.
- `apps/api/src/modules/intake/intake.controller.ts` — `GET /intakes/:id/evaluations`, `/latest`, `/:evaluationId`.
- `apps/web/src/lib/types.ts` — `IntakeEvaluation`, `EvaluationSection`, `QualityScore`, `AgentRun`, etc.
- `apps/web/src/lib/api-client.ts` — `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluation`.
- `apps/web/src/components/EvaluationPanel.tsx` — new: `EvaluationPanel`, summary card, quality score badge + breakdown, regen form, empty state.
- `apps/web/src/components/EvaluationSectionCard.tsx` — new: tabbed section browser, 12 section renderers, agent provenance footer.
- `apps/web/src/app/intakes/[id]/page.tsx` — added "Evaluation" tab, evaluation fetch on load, refresh after generate/regen.
- `tests/evaluation-api-read.test.mjs` — 8 new service-layer read tests.

Commands run:

```bash
npm run build:core   # clean
npm run api:build    # clean
npm run web:build    # clean
npm test             # 398/398 pass (8 new)
```

---

## 2026-06-15 — TASK-0020 Step 7: Section Regeneration via EvaluationOrchestrator

Wired `regenerateAnalysisDraft` to route through the `EvaluationOrchestrator` when it is injected. Guidance text is passed as `discoveryNotes`. If the orchestrator returns `clarification_required` during regen, a `ConflictError` is thrown (regen halted, state stays `intake_review`). On success, the new evaluation is persisted, the new draft supersedes the previous one, and the audit event `EVALUATION_REGENERATED` is recorded with `evaluationId`, `previousDraftId`, and `newDraftId`.

Changes made:

- `src/application/intake-workflow-service.ts` — `regenerateAnalysisDraft` routes to orchestrator path when `this.orchestrator` is set.
- `tests/generate-evaluation-service.test.mjs` — 2 new tests: regen supersedes previous draft + `EVALUATION_REGENERATED` audit trail event. Total: 10 new tests in this file, 390/390 passing.

Commands run:

```bash
npm run build:core   # clean
npm test             # 390/390 pass
```

---

## 2026-06-15 — TASK-0020 Wire EvaluationOrchestrator into Live Intake Workflow (Steps 1–6)

Wired the `EvaluationOrchestrator` 3-stage pipeline into `IntakeWorkflowService`. Steps 7 (section regeneration) deferred.

Changes made:

- `src/application/types.ts` — added `GenerateEvaluationInput` interface.
- `src/application/intake-workflow-service.ts` — added `orchestrator?: EvaluationOrchestrator` to options and class; added `generateEvaluation()` method (transitions `submitted → evaluating → intake_review`, persists `IntakeEvaluation` + `AgentRun` records, maps to legacy `IntakeAnalysisDraft`); `generateMockAnalysisDraft` delegates to `generateEvaluation` when orchestrator is injected (no frontend/controller changes needed).
- `apps/api/src/runtime/runtime.module.ts` — updated `IntakeWorkflowService` factory to inject `EvaluationOrchestrator` and pass it when `ANALYSIS_ENGINE=orchestrator`.
- `tests/generate-evaluation-service.test.mjs` — 8 new tests covering happy path, evaluation persistence, audit trail, draft field population, clarification_required routing, guard (no orchestrator), and mock-vs-orchestrator routing.

Commands run:

```bash
npm run build:core   # clean
npm run typecheck    # clean
npm test             # 388/388 pass (8 new)
```

---

## 2026-06-13 — TASK-0020P Draft Schema Extension: proposedArchitecture + implementationSuggestions

Requested: "more from the generated draft — proposed architecture and implementation suggestions".

Changes made:

- `src/application/providers/analysis-draft-output-schema.ts` — added `proposedArchitecture` (string) and `implementationSuggestions` (string[]) to `AnalysisDraftModelOutput` interface, JSON schema `required` + `properties`, and validator.
- `src/application/intake-analysis.ts` — added optional fields to `IntakeAnalysisDraft`; added `buildProposedArchitecture()` and `buildImplementationSuggestions()` helpers; mock builder now returns project-type-aware values for both fields.
- `src/application/providers/draft-output-mapper.ts` — passes the two new fields through to the domain draft.
- `src/application/providers/prompt-templates.ts` — OUTPUT RULES updated to instruct the AI to populate both fields.
- `apps/web/src/lib/types.ts` — added optional fields to web `IntakeAnalysisDraft` type.
- `apps/web/src/app/intakes/[id]/page.tsx` — AiDraftTab now renders "Proposed Architecture" and "Implementation Suggestions" cards after subtasks.
- `tests/*.test.mjs` — OpenAI, Anthropic, Bedrock fixture objects updated with the two new required fields (380/380 pass).

Commands run:

```bash
npm run build:core   # clean
npm test             # 380/380 pass
git push && ssh deploy: docker compose build + up -d (api + web)
```

Commit: `42d3d27`. Server redeployed and running.

## 2026-06-13 — TASK-0014P Intake Review Reject → Regenerate Loop Fix

Requested: sanity check on governance flow; found stuck state at `intake_review` — rejecting an analysis draft left no path to regenerate.

Changes made:

- `src/application/intake-workflow-service.ts` — `regenerateAnalysisDraft` now accepts the current draft when `reviewStatus` is `"draft"` or `"rejected"` (previously only `"draft"`); supersede step and audit metadata updated accordingly.
- `tests/guided-draft-regeneration.test.mjs` — renamed test 8 to reflect the real blocked case (accepted, not rejected); added test 8b covering the full reject → regenerate loop.

Commands run:

```bash
npm run build:core   # clean
npm test             # 380/380 pass (+1 new test)
```

No state machine changes. No governance boundary changes. Regen limit of 5 still applies. Blocked states (accepted, superseded) unchanged.

Commit: `e6ca087`

Follow-up: TASK-0020 — Wire orchestrator into live intake workflow.

## 2026-06-12 — TASK-0019 Prisma Persistence for IntakeEvaluation

Requested: add Prisma persistence for `IntakeEvaluation`, `EvaluationSection`, `AgentRun`; extend `ProjectIntakeStore` with 5 evaluation methods; implement in-memory and Prisma-backed stores; add mapper/persistence tests.

Changes made:

- `apps/api/prisma/schema.prisma` — added `IntakeEvaluation`, `EvaluationSection`, `AgentRun` models; added `evaluations IntakeEvaluation[]` relation to `ProjectIntake`.
- `src/application/evaluation-persistence.ts` — new file: `AgentRunRecord`, `EvaluationPersistenceBundle`, `agentRunsFromEvaluation()`, structural row interfaces (`EvaluationPersistenceRow`, `SectionPersistenceRow`, `AgentRunPersistenceRow`), and `fromEvaluationRow()`/`fromSectionRow()`/`fromAgentRunRow()` mapper functions.
- `src/application/types.ts` — extended `ProjectIntakeStore` with `saveEvaluation`, `getEvaluation`, `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `listAgentRuns`, `getEvaluationById?`.
- `src/application/in-memory-store.ts` — implemented all 6 new evaluation store methods; uses `validateIntakeEvaluation` on write/read.
- `apps/api/src/persistence/prisma-project-intake-store.ts` — implemented `saveEvaluation` (transaction: upsert evaluation, delete+recreate sections and runs), `getEvaluation`, `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `listAgentRuns`, `getEvaluationById`.
- `src/index.ts` — added `evaluation-persistence.ts` export.
- `tests/evaluation-persistence-memory.test.mjs` — 11 in-memory persistence tests.
- `tests/evaluation-persistence-prisma-mapping.test.mjs` — 16 mapper tests (no DB required).

Commands run:

```bash
npm run build:core   # clean
npm run api:build    # clean
npm run prisma:generate  # clean
npm test             # 379/379 pass (was 352, +27 new tests)
npm run demo:evaluation-orchestrator  # pass
npm run demo:mvp     # pass
npm run demo:analysis  # pass
npm run demo:analysis-review  # pass
npm run demo:review-guard  # pass
npm run demo:reviewed-distribution  # pass
npm run demo:guided-regen  # pass
```

No workflow behavior changed. No API routes added. No UI changes. Existing legacy analysis draft storage untouched.

Follow-up: TASK-0020 — Wire orchestrator into live intake workflow.

## 2026-06-12 — TASK-0018P Evaluation Orchestrator Patch

Requested: normalize agent confidence to 0–1 everywhere, fix demo output spacing, add feasibility weakness in MockCriticQAAgent when score < 60.

Changes made:

- `src/application/evaluation-orchestrator.ts` — changed confidence validation from `> 100` to `> 1`; error message updated to `out of range [0, 1]`.
- `src/application/agents/agent-contract.ts` — added JSDoc on `confidence`: `Must be in [0, 1]`.
- `src/application/agents/mock/mock-critic-qa-agent.ts` — `buildWeaknesses` now accepts `feasibility` + `riskSec`; adds weakness when `feasibility < 60` naming high-risk drivers.
- `tests/evaluation-orchestrator.test.mjs` — renamed "rejects agent confidence above 100" → "above 1", updated confidence values to 0–1 scale.
- `scripts/demo-evaluation-orchestrator.mjs` — fixed section output line to use `| conf=` separator.

Commands run:

```bash
npm run check  # 352/352 pass
npm run demo:evaluation-orchestrator  # pass, spacing fixed, feasibility=51 shown
```

## 2026-06-12 — TASK-0018 Evaluation Orchestrator

Requested: implement the in-memory evaluation orchestrator. 3-stage pipeline (Stage 1 serial, Stage 2 parallel, Stage 3 serial), clarification blocking, depth upgrade, per-agent provenance/timing, quality status mapping, NestJS DI wiring.

Changes made:

- `src/application/evaluation-orchestrator.ts` — `EvaluationOrchestrator` class with `orchestrate()` method; `ClarificationOutcome`, `EvaluationOrchestrationResult` types; `EvaluationOrchestrationError`, `AgentOutputValidationError`, `MissingEvaluationAgentError` error types.
- `tests/evaluation-orchestrator.test.mjs` — 45 orchestrator tests: construction, clarification blocking, depth routing, quality gating, provenance, validation, integration.
- `scripts/demo-evaluation-orchestrator.mjs` — 3-step demo: full pipeline, legacy draft round-trip, clarification_required.
- `src/index.ts` — added orchestrator export.
- `package.json` — added `demo:evaluation-orchestrator` script.
- `apps/api/src/runtime/runtime.module.ts` — registered `EvaluationOrchestrator` as NestJS provider.

Commands run:

```bash
npm run build      # clean
npm run api:build  # clean
npm run web:build  # clean
npm test           # 352/352 pass (was 307, +45 new tests)
npm run demo:evaluation-orchestrator  # pass
npm run demo:analysis    # unchanged
npm run demo:guided-regen  # unchanged
```

Follow-up: TASK-0019 — Prisma Persistence for IntakeEvaluation.

## 2026-06-12 — TASK-0017 Mock Agent Implementations — All 12 Evaluation Agents

Requested: implement all 12 deterministic mock evaluation agents. No real AI calls, no orchestrator, no Prisma changes.

Changes made:

- `src/application/agents/mock/mock-agent-helpers.ts` — shared helpers: normalize, containsAny, inferComplexity, estimateStoryPoints, inferTechStack, detectIntegrationPoints, detectDataStores, slugify.
- 12 mock agent files, one per section kind.
- `src/application/agents/mock/index.ts` — factory: `createAllMockEvaluationAgents`, `createMockEvaluationAgentsForDepth`, `runMockEvaluationAgentsSequentiallyForTest`.
- `tests/mock-evaluation-agents.test.mjs` — 49 agent-level tests.
- `tests/mock-evaluation-agent-factory.test.mjs` — 19 factory + round-trip tests.
- `src/index.ts` — added mock agents export.

Commands run:

```bash
npm run build      # clean
npm run api:build  # clean
npm run web:build  # clean
npm test           # 307/307 pass
npm run demo:analysis  # unchanged
```

Follow-up: TASK-0018 — Evaluation Orchestrator (3-stage pipeline, NestJS integration).

## 2026-06-12 — TASK-0016 Domain Foundation — Evaluation Aggregate & Agent Contracts

Requested: establish pure domain types for the 12-agent evaluation pipeline (Option A). No behavior change, no Prisma, no API routes, no UI.

Changes made:

- `src/application/intake-evaluation.ts` — 12 `EvaluationSectionKind` values, `EvaluationSection<TContent>` generic, all 12 typed section content interfaces, `IntakeEvaluation` aggregate, `QualityScore` with 6 dimensions + readiness band, depth routing table (`EVALUATION_DEPTH_ROUTING_TABLE`), `validateEvaluationSection`, `validateIntakeEvaluation`, helpers (`getSection`, `assertEvaluationSectionKind`, `qualityBandFromScore`).
- `src/application/agents/agent-contract.ts` — `AgentRunContext`, `AgentRunOptions`, `AgentOutput<TContent>`, `EvaluationAgent<TContent>` interface.
- `src/application/evaluation-draft-mapper.ts` — `evaluationToLegacyDraft()` + `legacyDraftToEvaluation()` bidirectional mapper.
- `tests/intake-evaluation-domain.test.mjs` — 31 tests.
- `tests/evaluation-agent-contract.test.mjs` — 15 tests.
- `tests/evaluation-draft-mapper.test.mjs` — 30 tests.
- `src/index.ts` — added exports for new modules.

Commands run:

```bash
npm run build      # clean
npm run api:build  # clean
npm run web:build  # clean
npm test           # 205/205 pass
```

Follow-up: TASK-0017 — 12 mock evaluation agents.

## 2026-06-12 — TASK-0015 AI Provider Router & Real Provider Adapters

Requested: add a real AI provider layer behind the `IntakeAnalysisProvider` interface. `IntakeWorkflowService` should route to OpenAI, Anthropic, Bedrock, or mock based on `AI_PROVIDER` env. No governance changes. No silent fallback.

Changes made:

- `src/application/intake-analysis-provider.ts` — `IntakeAnalysisProvider` interface, options, result, metadata types.
- `src/application/providers/` — `analysis-draft-output-schema.ts`, `prompt-templates.ts`, `token-cost.ts`, `analysis-provider-config.ts`, `mock-intake-analysis-provider.ts`, `draft-output-mapper.ts`, `openai-intake-analysis-provider.ts`, `anthropic-intake-analysis-provider.ts`, `bedrock-intake-analysis-provider.ts`, `analysis-provider-router.ts`.
- `apps/api/src/ai/provider.token.ts` — shared `ANALYSIS_PROVIDER` Symbol injection token.
- `apps/api/src/runtime/runtime.module.ts` — factory for `ANALYSIS_PROVIDER`, injected into `IntakeWorkflowService`.
- `apps/api/src/modules/health/health.controller.ts` — injects `ANALYSIS_PROVIDER`, `/health` exposes `ai.provider`.
- `src/index.ts` — exports new provider interface and related types.
- `.env.example`, `.env.server.example` — AI provider env vars documented.
- `scripts/smoke-ai-provider.mjs`, `package.json` — `smoke:ai-provider` script.
- `tests/analysis-provider-config.test.mjs`, `tests/analysis-provider-router.test.mjs`, `tests/mock-intake-analysis-provider.test.mjs`, `tests/openai-intake-analysis-provider.test.mjs`, `tests/anthropic-intake-analysis-provider.test.mjs`, `tests/bedrock-intake-analysis-provider.test.mjs` — 44 new tests.

Commands run:

```bash
npm run build:core   # passed
npm test             # 127/127 passed (44 new tests added)
npm run smoke:ai-provider  # passed (mock provider)
npm run api:build    # passed
```

Two TypeScript fixes required:
- `anthropic-intake-analysis-provider.ts`: cast via `as unknown as Anthropic.Tool["input_schema"]` due to `readonly` tuple.
- `bedrock-intake-analysis-provider.ts`: cast via `{ json: ... } as ToolInputSchema` due to Smithy `DocumentType` mismatch with `readonly` schema object.

## 2026-06-12 — TASK-0014 guided AI draft regeneration

Requested: let `intake_owner` and `devops_lead` steer the mock AI toward a better draft via free-text guidance.

Context: TASK-0013 made actor attribution real, so guidance is now attributable to an authenticated person.

Changes made:
- `src/domain/permissions.ts` — added `steer_analysis_draft` action; granted to `intake_owner`, `devops_lead`, `admin`.
- `src/application/errors.ts` — added `ConflictError` (maps to HTTP 409).
- `src/application/types.ts` — added `RegenerateAnalysisDraftInput` interface; added `analysisDraftRegenerationCount` to `ProjectIntakeRecord`.
- `src/application/intake-analysis.ts` — added `guidance?: string` to `GenerateMockAnalysisDraftInput`; mock provider visibly incorporates guidance (scope note + story point bias).
- `src/application/intake-workflow-service.ts` — added `regenerateAnalysisDraft()` with all guards; supersedes prior draft; increments counter; emits `ANALYSIS_DRAFT_REGENERATED` audit event.
- `apps/api/src/common/application-exception.filter.ts` — mapped `ConflictError` to `ConflictException` (409).
- `apps/api/src/modules/intake/dto/regenerate-analysis-draft.dto.ts` — new DTO with `@IsString() @MinLength(10) guidance`.
- `apps/api/src/modules/intake/intake.controller.ts` — added `POST /intakes/:id/analysis-drafts/regenerate`.
- `tests/guided-draft-regeneration.test.mjs` — 10 new tests (all pass).
- `scripts/demo-guided-regeneration.mjs` — full v1 → guidance → v2 → guidance → v3 → accept demo.
- `package.json` — added `demo:guided-regen` npm script.

Verification:
- `npm run check` — PASS (83/83, including 10 new tests)
- `npm run api:build` — PASS
- `npm run demo:guided-regen` — PASS (v1→v2→v3→accept→Gate1 flow confirmed)

Next: TASK-0015 — real AI provider integration (guidance field maps directly onto prompt)

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

---

## 2026-06-22 — TASK-0031: Post-Distribution Lifecycle

**Session:** Continuing from prior session (TASK-0029 and TASK-0030 already complete)

**Changes:**
- Added `in_progress`, `blocked`, `completed`, `canceled` to `RequestStatus` Prisma enum + domain types
- Created `src/domain/lifecycle-transitions.ts` with `validateLifecycleTransition()` pure domain function
- Added lifecycle metadata fields (`blockedAt`, `completedAt`, etc.) to `ProjectIntakeRecord`
- Added `executeLifecycleTransition()` to `IntakeWorkflowService`
- Created `POST /intakes/:id/lifecycle/:action` NestJS endpoint + DTO
- Added lifecycle functions to web api-client
- Added 4 new statuses to `apps/web/src/lib/status.ts`
- Created `/distributed` dashboard page for post-distribution lifecycle management
- 528/528 tests pass

**Follow-up:** Run `prisma migrate dev --name add-post-distribution-lifecycle` on oreochiserver

---

## 2026-06-23 — TASK-0032: Input Validation Hardening

**Session:** Continuing from TASK-0031 same session

**Changes:**
- Created `apps/api/src/common/validation-constants.ts` with 14 named length constants
- Added `@MaxLength` decorators to all DTO string fields: `CreateIntakeDto`, `RequestChangesDto`, `ApprovalDecisionDto`, `RejectAnalysisDraftDto`, `RegenerateAnalysisDraftDto`, `CompleteDiscoveryDto`, `LifecycleTransitionDto`
- Replaced magic numbers in `LifecycleTransitionDto` with named constants
- Changed `forbidNonWhitelisted: false` → `true` in global ValidationPipe
- Created `tests/input-validation.test.mjs` (34 tests) using `class-validator`'s `validate()` directly
- 528/528 tests pass (pre-TASK-0033 count)

---

## 2026-06-23 — TASK-0033: Google OAuth Activation

**Session:** New session

**Context:** Full Google OAuth implementation already existed from TASK-0027. This task activated it.

**Changes:**
- `src/auth-config-validator.ts` — removed TODO hold; now hard-fails at startup when `AUTH_MODE=google` and `AUTH_GOOGLE_CLIENT_ID` is missing; fixed env var name (`GOOGLE_CLIENT_ID` → `AUTH_GOOGLE_CLIENT_ID` to match service)
- `tests/auth-config-validator.test.mjs` — added `AUTH_GOOGLE_CLIENT_ID` env setup to google-mode success tests; added new test: google mode without client ID throws
- `tests/google-oauth.test.mjs` — NEW: 23 tests covering URL generation, state token format, role config env parsing, session TTL math, forbidden-user path
- `docs/ai/tasks/TASK-0033-google-oauth.md` — NEW task log with activation checklist for oreochiserver
- 582/582 tests pass (54 new tests added across TASK-0032 and TASK-0033)

**Open blocker:** `AUTH_GOOGLE_CLIENT_ID` and `AUTH_GOOGLE_CLIENT_SECRET` still need to be provisioned in Google Cloud Console and added to `.env.server` before `AUTH_MODE=google` can be activated on oreochiserver.

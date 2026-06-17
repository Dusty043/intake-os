# TASK-0023A — Provisioning Execution Foundation

**Status:** COMPLETE
**Date:** 2026-06-17
**Branch:** main

---

## Goal

Create the backend execution shape for "distribute to external systems" without any real Monday or GitHub writes. Everything runs against a mock registry. This gives us stable types, guards, persistence, and API surface before inserting real adapters.

---

## What Was Built

### New domain types — `src/domain/provisioning.ts`

- `ProvisioningRunStatus`: `executing | completed | failed | partial_success`
- `ProvisioningTargetStatus`: `pending | succeeded | failed | skipped`
- `ProvisioningTargetKind`: `monday_project_item | github_repo | github_issues | google_chat_notification`
- `ProvisioningTargetResult` — per-target outcome with idempotency key, external ID/URL, error message, attempt count
- `ProvisioningRun` — full run record with status + target results

### Executor interface + registry — `src/application/provisioning/provisioning-executor.ts`

- `ProvisioningContext` — passed to each executor: intakeId, planId, runId, actor, reviewedPackage
- `ProvisioningExecutor` interface — `targetKind`, `execute(ctx)`, `canRetry(result)`
- `ProvisioningRegistry` — map of targetKind → executor; `.register()` / `.getAll()` / `.size`

### Mock executors — `src/application/provisioning/mock-executor.ts`

- `MockMondayExecutor` — returns `monday_project_item` result
- `MockGithubExecutor` — returns `github_repo` result
- `MockExecutorMode`: `"success" | "full_failure" | "monday_fail" | "github_fail"`
- `createMockRegistry(mode)` — convenience factory; returns both mock executors
- Controlled via `PROVISIONING_EXECUTOR_MODE` env var (default: `"success"`)

### Prisma schema additions — `apps/api/prisma/schema.prisma`

- `ProvisioningRun` model — persists run status, actor, timestamps; related to `ProjectIntake` and `ProvisioningPlan`
- `ProvisioningTargetResult` model — per-target outcome with `@@unique` idempotency key
- Migration: `20260617135057_add_provisioning_run`

### Store interface extensions — `src/application/types.ts` + `src/application/in-memory-store.ts`

- Added `saveProvisioningRun`, `listProvisioningRuns`, `getProvisioningRun` to `ProjectIntakeStore`
- Implemented in both `InMemoryProjectIntakeStore` and `PrismaProjectIntakeStore`
- Re-exports `ProvisioningRun`, `ProvisioningTargetResult`, `ProvisioningRunStatus`, etc. from `types.ts`

### Workflow service — `src/application/intake-workflow-service.ts`

New method: `executeDistribution(id, actor)`:

**Guards (all must pass):**
1. `status === "approved"`
2. Gate 1 approved
3. Gate 2 approved
4. `provisioningPlan.status === "ready_for_provisioning"` exists
5. No run currently `"executing"` (idempotency)
6. `reviewedProjectPackage` is set
7. Registry is non-empty

**Execution flow:**
1. Save run in `"executing"` state
2. Transition intake `approved → provisioning` via `start_provisioning`
3. Emit `DISTRIBUTION_EXECUTION_STARTED` audit event
4. Run all executors in parallel
5. Compute run status: all succeeded → `completed`, all failed → `failed`, mixed → `partial_success`
6. Save completed run
7. Transition intake: `completed → distributed`, else `→ provisioning_failed`
8. Emit `DISTRIBUTION_EXECUTION_COMPLETED` or `DISTRIBUTION_EXECUTION_FAILED`
9. Return the completed `ProvisioningRun`

Also added: `listProvisioningRuns(intakeId)`.
Added `provisioningRegistry?: ProvisioningRegistry` to `IntakeWorkflowServiceOptions`.

### API endpoints — `apps/api/src/modules/intake/intake.controller.ts`

```
POST /intakes/:id/distribution/execute  → ProvisioningRunDto
GET  /intakes/:id/distribution/runs     → { runs: ProvisioningRunDto[] }
```

### DTO — `apps/api/src/modules/intake/dto/provisioning-run.dto.ts`

`ProvisioningRunDto` + `ProvisioningTargetResultDto` + `toProvisioningRunDto()` mapper.

### Runtime wiring — `apps/api/src/runtime/runtime.module.ts`

- Constructs `ProvisioningRegistry` + `createMockRegistry(mode)` on startup
- Reads `PROVISIONING_EXECUTOR_MODE` env var (default: `"success"`)
- Logs: `Provisioning executor: mock (mode=...)`

### Exports — `src/index.ts`

Added exports for:
- `./application/provisioning/provisioning-executor.js`
- `./application/provisioning/mock-executor.js`
- `./domain/provisioning.js`

---

## Tests — `tests/provisioning-execution.test.mjs`

9 tests, all pass:

1. Full success → `completed`, intake `distributed`
2. Full failure → `failed`, intake `provisioning_failed`
3. Monday fails → `partial_success`, intake `provisioning_failed`
4. GitHub fails → `partial_success`
5. Guard: no gate_1 approval → `ValidationError`
6. Guard: plan not `ready_for_provisioning` → `ValidationError`
7. Guard: no registry → `ValidationError`
8. Run is persisted and returned by `listProvisioningRuns`
9. Successful run stores external IDs from mock executor

**Total test suite: 407/407 passing**

---

## What Was NOT Built (non-goals)

- Monday writes (TASK-0023D)
- GitHub writes (TASK-0023E)
- UI for executing/viewing runs (TASK-0023B)
- Retry endpoint (TASK-0023C)

---

## Handoff Notes

- Real Monday/GitHub adapters plug in via `provisioningRegistry.register(adapter)` in `runtime.module.ts` — no workflow changes required
- The `PROVISIONING_EXECUTOR_MODE` env var controls mock behavior for local testing
- The `ProvisioningRun.idempotencyKey` on each target (`intakeId:planId:targetKind`) prevents duplicate external writes on retry
- `executeDistribution` is synchronous in v1 — acceptable for demo; background job queue is a future upgrade

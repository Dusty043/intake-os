# TASK-0023C — Retry Failed Provisioning Targets

**Status:** COMPLETE
**Date:** 2026-06-17
**Branch:** main

---

## Goal

Allow failed provisioning targets to be retried without duplicating successful writes. Creates a new `ProvisioningRun` of `kind: "retry"` that only runs executors for failed+retryable targets from the specified source run.

---

## What Was Built

### Domain types — `src/domain/provisioning.ts`

- `ProvisioningRunKind = "initial" | "retry"` added
- `ProvisioningRun`: new fields `kind`, `retryOfRunId?`
- `ProvisioningTargetResult`: new field `retryable: boolean`

### Provisioning context — `src/application/provisioning/provisioning-executor.ts`

- `ProvisioningContext`: added `isRetry: boolean`

### Mock executors — `src/application/provisioning/mock-executor.ts`

- `MockExecutorMode` extended with:  `"github_fail_then_succeed"`, `"monday_fail_then_succeed"`, `"both_fail_then_succeed"`
- `makeResult()`: `retryable` is `true` on failed results, `false` on succeeded
- Idempotency key: `${intakeId}:${planId}:${targetKind}` for initial; `${intakeId}:${planId}:${targetKind}:retry:${runId}` for retry (prevents DB uniqueness conflict)
- Mock executors use `shouldSucceed(isRetry)` switch — retry-aware modes succeed on second attempt

### Workflow service — `src/application/intake-workflow-service.ts`

- `executeDistribution`: now sets `kind: "initial"` and `isRetry: false`
- `retryFailedProvisioningTargets(intakeId, runId, actor)`: new method with 8 guards:
  1. Intake status must be `provisioning_failed`
  2. Gate 1 complete
  3. Gate 2 complete
  4. Plan must be `ready_for_provisioning`
  5. No registry / empty registry
  6. No currently-executing run
  7. Original run must exist
  8. Original run must have at least one `failed + retryable` target
  9. `reviewedProjectPackage` must exist
- State path: `provisioning_failed → provisioning → distributed` (if completed) or `→ provisioning_failed` (if any failures)
- Audit events: `DISTRIBUTION_RETRY_STARTED`, `DISTRIBUTION_RETRY_COMPLETED`, `DISTRIBUTION_RETRY_FAILED`

### Prisma schema + migration — `apps/api/prisma/schema.prisma`

Migration: `20260617144700_add_provisioning_retry_fields`

- `ProvisioningRun`: `kind String @default("initial")`, `retryOfRunId String?`
- `ProvisioningTargetResult`: `retryable Boolean @default(true)`

### Persistence — `apps/api/src/persistence/prisma-project-intake-store.ts`

- `saveProvisioningRun`: persists `kind` and `retryOfRunId`
- `saveProvisioningTargetResult`: persists `retryable`
- `fromProvisioningRunRow`: maps `kind`, `retryOfRunId`, `retryable`

### DTO — `apps/api/src/modules/intake/dto/provisioning-run.dto.ts`

- `ProvisioningRunDto`: added `kind`, `retryOfRunId?`
- `ProvisioningTargetResultDto`: added `retryable`
- `toProvisioningRunDto`: maps new fields

### Controller — `apps/api/src/modules/intake/intake.controller.ts`

Added:
```
POST /intakes/:id/distribution/runs/:runId/retry
```

### Web types — `apps/web/src/lib/types.ts`

- `ProvisioningRun`: `kind`, `retryOfRunId?`
- `ProvisioningTargetResult`: `retryable`

### API client — `apps/web/src/lib/api-client.ts`

- `retryProvisioningRun(id, runId, actor)` added

### UI — `apps/web/src/app/intakes/[id]/page.tsx`

- `ProvisioningRunPanel`: accepts `canRetry`, `onRetry`, `retrying` props
  - Shows "Retry" badge on retry-kind runs
  - Shows "Retry Failed Targets" button when run has failed+retryable targets and intake is `provisioning_failed`
- `DistributionTab`: added `doRetry(runId)` handler, `retryingRunId` state, `canRetryRun` flag
- Renamed "Approve for Execution" → "Mark Plan Ready"

### Tests — `tests/provisioning-retry.test.mjs`

11 tests covering:
- `github_fail_then_succeed` recovery → `distributed`
- `monday_fail_then_succeed` recovery → `distributed`
- `both_fail_then_succeed` recovery → `distributed`
- `full_failure` retry still fails → stays `provisioning_failed`
- Idempotency key uniqueness between initial/retry
- Only failed retryable targets are retried (succeeded targets skipped)
- Both runs appear in `listProvisioningRuns`
- Guard: not `provisioning_failed` → ValidationError
- Guard: unknown run ID → NotFoundError
- Guard: no retryable failures → ValidationError (via already-distributed path)
- Correct `triggeredBy` fields on retry run

---

## Handoff

**What changed:** Retry mechanism wired end-to-end. Domain, persistence, API, and UI all updated.

**What was not changed:** Real Monday/GitHub adapters — still mock only. No adapter retry logic at the external API level; that's 0023D/E.

**How tested:** 418/418 unit tests pass; typecheck clean.

**Open questions:** None for this task.

**Next:** TASK-0023D (Monday adapter) and TASK-0023E (GitHub adapter) — both blocked pending credentials.

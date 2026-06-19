# TASK-0028 — Failure and Recovery

**Status:** COMPLETE  
**Priority:** HIGH — must land before Monday/GitHub adapters go live  
**Estimated effort:** 4–6 hours  
**Blocked on:** nothing (all work is internal)  
**Product spec:** `docs/product/failure-and-recovery.md`

---

## Problem

The provisioning layer has the shape for recovery (`retryable: Boolean`, `errorMessage`, `attemptCount`, `retryOfRunId`) but almost none of the behavior:

- No error category enum — failures are stored as raw strings with no classification
- No maximum retry threshold — `attemptCount` increments but there's no limit that triggers dead-letter promotion
- No dead-letter state — exhausted retries silently stay as `failed` with no admin signal
- No exponential backoff — retries fire immediately with no delay
- No admin recovery surface — failed runs are visible in the UI but there's no "retry this target" or "mark as manually resolved" action
- No audit event for retry or dead-letter transitions

When Monday and GitHub go live, a network blip during provisioning will produce a permanently broken `ProvisioningTargetResult` with no path to recovery. This is a data loss risk.

---

## Acceptance Criteria

- [ ] `ProvisioningTargetResult` carries an `errorCategory` column (Prisma migration required)
- [ ] `ProvisioningTargetResult` carries a `deadLettered` boolean column (Prisma migration required)
- [ ] `ProvisioningTargetResult` carries a `maxAttempts` int column (Prisma migration required)
- [ ] `ProvisioningRun` carries a `errorSummary` column (Prisma migration required)
- [ ] An `ErrorCategory` enum is defined and shared across the domain layer
- [ ] External API errors (Monday, GitHub) are normalized into `ErrorCategory` before storage
- [ ] A target that reaches `maxAttempts` is automatically promoted to dead-letter status
- [ ] Dead-letter promotion creates an audit event
- [ ] A retry executor helper implements exponential backoff with jitter
- [ ] The retry endpoint (`POST /provisioning-runs/:id/retry`) filters to retryable, non-dead-lettered targets only
- [ ] A manual recovery endpoint allows authorized users to mark a dead-lettered target as manually resolved
- [ ] Manual recovery creates an audit event
- [ ] Admin failure dashboard page lists all provisioning runs with any failed targets
- [ ] Unit tests cover all retry/dead-letter scenarios (see test list below)

---

## What to Build

### Phase 1 — Error category enum (domain layer)

**New file:** `src/domain/error-categories.ts`

```typescript
export const provisioningErrorCategories = [
  "transient_api_error",   // HTTP 5xx, network timeout, connection reset
  "rate_limit",            // HTTP 429 or provider-specific rate limit
  "auth_error",            // HTTP 401, 403, revoked token
  "validation_error",      // HTTP 400, schema mismatch, missing required field
  "collision",             // resource already exists
  "config_error",          // missing board ID, missing org, bad column map
  "unknown",               // anything that doesn't match above
] as const;

export type ProvisioningErrorCategory =
  (typeof provisioningErrorCategories)[number];

export const retryableCategories: ProvisioningErrorCategory[] = [
  "transient_api_error",
  "rate_limit",
];

export function isRetryable(category: ProvisioningErrorCategory): boolean {
  return retryableCategories.includes(category);
}
```

### Phase 2 — Schema migration

Add to `apps/api/prisma/schema.prisma`:

```prisma
model ProvisioningTargetResult {
  // ... existing fields ...
  errorCategory   String?   // ProvisioningErrorCategory
  deadLettered    Boolean   @default(false)
  maxAttempts     Int       @default(3)
  deadLetteredAt  DateTime?
}

model ProvisioningRun {
  // ... existing fields ...
  errorSummary    String?
}
```

Run `prisma migrate dev --name add-error-category-and-dead-letter`.

### Phase 3 — Error normalizer

**New file:** `src/application/provisioning/error-normalizer.ts`

```typescript
export function normalizeProvisioningError(
  err: unknown,
  targetKind: ProvisioningTargetKind,
): { category: ProvisioningErrorCategory; message: string; retryable: boolean } {
  // HTTP 429 or provider-specific "rate limit" text → rate_limit
  // HTTP 401/403 → auth_error
  // HTTP 400 / JSON schema mismatch → validation_error
  // "already exists" / collision strings → collision
  // HTTP 5xx / ECONNRESET / ETIMEDOUT → transient_api_error
  // config guard failures → config_error
  // everything else → unknown
}
```

The executor adapters (Monday, GitHub) call this normalizer and return the category alongside the error message. The target result stores both.

### Phase 4 — Dead-letter logic

Inside `IntakeWorkflowService.retryFailedProvisioningTargets()` (or wherever targets are updated after a retry attempt), add:

```typescript
if (target.attemptCount >= target.maxAttempts) {
  // promote to dead-letter
  await db.provisioningTargetResult.update({
    where: { id: target.id },
    data: {
      deadLettered: true,
      deadLetteredAt: new Date(),
      retryable: false,
    },
  });
  await auditLogger.log({
    action: "provisioning_target_dead_lettered",
    requestId: run.intakeId,
    targetId: target.id,
    targetKind: target.targetKind,
    attemptCount: target.attemptCount,
    errorCategory: target.errorCategory,
  });
}
```

### Phase 5 — Exponential backoff helper

**New file:** `src/application/provisioning/backoff.ts`

```typescript
export interface BackoffOptions {
  baseDelayMs?: number;    // default: 1000
  maxDelayMs?: number;     // default: 30000
  jitterFactor?: number;   // default: 0.2 (±20%)
}

export function calculateBackoffMs(
  attemptNumber: number,
  opts: BackoffOptions = {},
): number {
  const base = opts.baseDelayMs ?? 1000;
  const max = opts.maxDelayMs ?? 30_000;
  const jitter = opts.jitterFactor ?? 0.2;

  const exponential = base * Math.pow(2, attemptNumber - 1);
  const capped = Math.min(exponential, max);
  const noise = capped * jitter * (Math.random() * 2 - 1);
  return Math.round(capped + noise);
}
```

The retry executor uses this to delay before each re-attempt. The current synchronous retry (which fires immediately) is replaced with an awaited sleep before each retry attempt, or the delay is stored and the retry is scheduled as a deferred job.

For v1, a synchronous delay inside the retry service is acceptable. For v2, the delay should be a scheduled job.

### Phase 6 — Manual recovery endpoint

**New controller action** in `apps/api/src/modules/intake/intake.controller.ts`:

```
POST /intakes/:id/provisioning-targets/:targetId/mark-resolved
```

Body:
```json
{ "note": "Manually created Monday item. External ID: 123456789" }
```

Authorization: `devops_lead` or `admin` only.

Behavior:
- Marks target as `succeeded` with `completedAt = now()`
- Sets `deadLettered = false` if it was dead-lettered
- Stores note in the target's `errorMessage` field (prefixed with `[MANUAL] `)
- Creates an `AuditEvent` with `action: "provisioning_target_manually_resolved"`

### Phase 7 — Admin failure dashboard (UI)

**New page:** `apps/web/src/app/admin/failures/page.tsx`

Shows:
- All `ProvisioningRun` records where `status = "failed"` or `status = "partial_success"`
- Grouped by intake title
- For each run: list all `ProvisioningTargetResult` records with their status, error category, attempt count, dead-lettered flag, and error message
- Dead-lettered targets highlighted in red
- Actions per target:
  - "Retry" button (if `retryable = true` and `deadLettered = false`)
  - "Mark Resolved" button (if `status = "failed"` and user has `devops_lead` or `admin` role)

---

## Schema Changes (Summary)

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `ProvisioningTargetResult` | `errorCategory` | `String?` | null | Normalized error category |
| `ProvisioningTargetResult` | `deadLettered` | `Boolean` | false | Exhausted all retries |
| `ProvisioningTargetResult` | `maxAttempts` | `Int` | 3 | Configurable per target |
| `ProvisioningTargetResult` | `deadLetteredAt` | `DateTime?` | null | When it was dead-lettered |
| `ProvisioningRun` | `errorSummary` | `String?` | null | Human-readable run failure summary |

---

## Files to Create / Change

| File | Change |
|---|---|
| `src/domain/error-categories.ts` | NEW — error category enum and helpers |
| `src/application/provisioning/error-normalizer.ts` | NEW — normalize external API errors |
| `src/application/provisioning/backoff.ts` | NEW — exponential backoff calculator |
| `apps/api/prisma/schema.prisma` | ADD columns (see above) |
| `apps/api/prisma/migrations/...` | NEW — generated migration |
| `src/application/intake-workflow-service.ts` | ADD dead-letter promotion logic |
| `apps/api/src/modules/intake/intake.controller.ts` | ADD mark-resolved endpoint |
| `apps/web/src/app/admin/failures/page.tsx` | NEW — admin failure dashboard |
| `tests/provisioning-failure-recovery.test.mjs` | NEW — unit tests |

---

## Tests Required

```
tests/provisioning-failure-recovery.test.mjs
```

| Test | Description |
|---|---|
| transient error is classified correctly | HTTP 503 → `transient_api_error`, `retryable: true` |
| rate limit is classified correctly | HTTP 429 → `rate_limit`, `retryable: true` |
| auth error is classified correctly | HTTP 401 → `auth_error`, `retryable: false` |
| validation error is classified correctly | HTTP 400 → `validation_error`, `retryable: false` |
| collision is classified correctly | "already exists" → `collision`, `retryable: false` |
| target reaches max attempts → dead-lettered | 3 failures → `deadLettered: true` |
| dead-letter creates audit event | Audit event written with correct fields |
| backoff grows exponentially | attempt 1 < attempt 2 < attempt 3 |
| backoff capped at maxDelayMs | attempt 10 ≤ maxDelayMs |
| retry endpoint skips dead-lettered targets | Dead-lettered target not re-attempted |
| retry endpoint skips non-retryable targets | `retryable: false` target not re-attempted |
| mark-resolved requires authorized role | Submitter role → 403 |
| mark-resolved creates audit event | Audit event written with actor, note, and prior state |
| partial provisioning preserves succeeded targets | Retry of partial run only touches failed targets |

---

## Retry Behavior Summary

| Category | Auto-retry | Backoff | Max attempts | Dead-letter |
|---|---|---|---|---|
| `transient_api_error` | Yes | Exponential | 3 | Yes, after 3 |
| `rate_limit` | Yes | Exponential | 3 | Yes, after 3 |
| `auth_error` | No | N/A | 1 | Immediately |
| `validation_error` | No | N/A | 1 | Immediately |
| `collision` | No | N/A | 1 | Immediately |
| `config_error` | No | N/A | 1 | Immediately |
| `unknown` | No | N/A | 1 | Immediately |

---

## What NOT to Change

- Do not modify approval gate logic.
- Do not change the existing `ProvisioningRun` `status` enum values — add alongside.
- Do not modify the idempotency key logic — it is correct and must not be touched.
- Do not build a full background job queue (BullMQ/Redis) in this task — synchronous retry with backoff sleep is sufficient for v1.

---

## Open Questions

| ID | Question | Owner |
|---|---|---|
| Q-FAR-1 | Should `maxAttempts` be configurable per target kind (Monday vs GitHub may warrant different limits)? | Engineering |
| Q-FAR-2 | Should dead-letter promotion send a Google Chat notification? | Product |
| Q-FAR-3 | Should the backoff sleep be synchronous (simple) or scheduled as a future job (correct but more complex)? | Engineering |

---

## Handoff

This task is prerequisite before Monday and GitHub adapters process real production requests. Without dead-letter logic, a single network blip during provisioning creates an unrecoverable state. The domain changes (error categories, backoff helper) are pure TypeScript with no external deps. The schema migration is additive (all new columns are nullable or have defaults). The UI change is a new read-only page — no risk to existing UI.

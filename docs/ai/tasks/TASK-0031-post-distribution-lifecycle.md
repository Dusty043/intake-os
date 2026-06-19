# TASK-0031 — Post-Distribution Lifecycle

**Status:** READY — no credentials required  
**Priority:** MEDIUM — needed before the first real provisioned project completes  
**Estimated effort:** 2–3 hours  
**Blocked on:** nothing  
**Product spec:** `docs/product/post-distribution-lifecycle.md`

---

## Current State

The `RequestStatus` enum in `schema.prisma` currently ends at `distributed` and `provisioning_failed` (plus `archived`). There is no `in_progress`, `blocked`, `completed`, or `canceled` status. Once a project is `distributed`, there's no way to record what happens to it downstream — it's invisible to the app.

```prisma
// Current RequestStatus enum (partial)
enum RequestStatus {
  // ...
  distributed
  provisioning_failed
  archived
}
```

The product spec defines a full lifecycle after distribution (see `docs/product/post-distribution-lifecycle.md` for the transition table). This task implements the minimum viable version: status enum expansion, lifecycle transition endpoints, metadata fields, audit logging, and a basic distributed-projects dashboard.

---

## Acceptance Criteria

- [ ] `RequestStatus` enum extended with: `in_progress`, `blocked`, `completed`, `canceled` (Prisma migration required)
- [ ] `ProjectIntake` model extended with lifecycle metadata fields (Prisma migration required)
- [ ] Lifecycle transition endpoints implemented for all valid transitions from the product spec
- [ ] Each transition validates the current status and rejects invalid transitions with a clear error
- [ ] Each transition creates an `AuditEvent` record
- [ ] `canceled` transition does NOT delete downstream resources (Monday/GitHub) — cancellation is a status record only
- [ ] `archived` status blocks all lifecycle updates (including new lifecycle transitions)
- [ ] Restored/unarchived behavior is out of scope for v1 — `archived` is terminal
- [ ] Only `devops_lead` and `admin` roles can execute lifecycle transitions (enforced server-side)
- [ ] A basic distributed projects list page exists in the UI, filterable by lifecycle status
- [ ] Unit tests cover all valid and invalid transitions

---

## What to Build

### Phase 1 — Enum and schema changes

**Expand `RequestStatus` enum in `apps/api/prisma/schema.prisma`:**

```prisma
enum RequestStatus {
  draft
  submitted
  evaluating
  clarification_required
  intake_review
  devops_review
  approved
  provisioning
  distributed
  provisioning_failed
  archived
  in_progress    // NEW
  blocked        // NEW
  completed      // NEW
  canceled       // NEW
}
```

**Add lifecycle metadata fields to `ProjectIntake`:**

```prisma
model ProjectIntake {
  // ... existing fields ...

  // Lifecycle metadata (all nullable — only populated post-distribution)
  lifecycleNote       String?
  blockedReason       String?
  blockedAt           DateTime?
  unblockedAt         DateTime?
  completedAt         DateTime?
  completedNote       String?
  canceledAt          DateTime?
  canceledReason      String?
  archivedAt          DateTime?
}
```

Run `prisma migrate dev --name add-post-distribution-lifecycle`.

### Phase 2 — Domain: lifecycle transitions

**New file:** `src/domain/lifecycle-transitions.ts`

```typescript
import type { RequestStatus } from "./types.js";

export type LifecycleAction =
  | "mark_started"
  | "mark_blocked"
  | "unblock"
  | "mark_completed"
  | "mark_canceled"
  | "archive";

export const lifecycleTransitions: Record<
  LifecycleAction,
  { from: RequestStatus[]; to: RequestStatus }
> = {
  mark_started:    { from: ["distributed"],                          to: "in_progress" },
  mark_blocked:    { from: ["distributed", "in_progress"],           to: "blocked" },
  unblock:         { from: ["blocked"],                              to: "in_progress" },
  mark_completed:  { from: ["in_progress", "blocked"],               to: "completed" },
  mark_canceled:   { from: ["distributed", "in_progress", "blocked"], to: "canceled" },
  archive:         { from: ["completed", "canceled"],                to: "archived" },
};

export function validateLifecycleTransition(
  current: RequestStatus,
  action: LifecycleAction,
): { valid: boolean; reason?: string } {
  const transition = lifecycleTransitions[action];
  if (!transition) return { valid: false, reason: `Unknown action: ${action}` };
  if (!transition.from.includes(current)) {
    return {
      valid: false,
      reason: `Cannot ${action} from status "${current}". Allowed from: ${transition.from.join(", ")}.`,
    };
  }
  if (current === "archived") {
    return { valid: false, reason: "Archived records cannot be transitioned." };
  }
  return { valid: true };
}
```

### Phase 3 — Service method

Add to `IntakeWorkflowService`:

```typescript
async executeLifecycleTransition(
  intakeId: string,
  action: LifecycleAction,
  actor: AuthenticatedActor,
  metadata: {
    note?: string;
    reason?: string;
  },
): Promise<void>
```

This method:
1. Loads the intake record
2. Calls `validateLifecycleTransition(current, action)`
3. If invalid, throws `BadRequestException` with the reason
4. Builds the metadata update (sets `blockedAt`, `completedAt`, etc. based on action)
5. Updates `ProjectIntake` status and metadata fields in one transaction
6. Writes an `AuditEvent` with `action: "lifecycle_transition"`, `from`, `to`, `actor`, `note`

### Phase 4 — Controller endpoints

**Add to `IntakeController`:**

```
POST /intakes/:id/lifecycle/:action
```

Where `action` is one of: `mark_started`, `mark_blocked`, `unblock`, `mark_completed`, `mark_canceled`, `archive`.

Body:
```json
{
  "note": "Execution started by DS team",
  "reason": "Waiting on client access credentials"
}
```

Both fields optional. `reason` is required for `mark_blocked` and `mark_canceled` (enforced by DTO validation).

Authorization: `devops_lead` or `admin` only.

**New DTO:** `apps/api/src/modules/intake/dto/lifecycle-transition.dto.ts`

```typescript
export class LifecycleTransitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

### Phase 5 — Distributed projects dashboard (UI)

**New page:** `apps/web/src/app/distributed/page.tsx`

Shows all intakes with status in: `distributed`, `in_progress`, `blocked`, `completed`, `canceled`, `archived`.

Columns:
- Project title (link to detail)
- Status badge (color-coded)
- Provisioned date
- Downstream links (Monday URL, GitHub URL from `ExternalLink` records)
- Current lifecycle note
- Actions: available lifecycle transition buttons based on current status and user role

Filter bar:
- Status filter (multi-select)
- Date range filter

The detail page (`/intakes/:id`) should also show lifecycle status and transition buttons in the provisioning section.

---

## Schema Changes (Summary)

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `ProjectIntake` | `lifecycleNote` | `String?` | null | Latest operational note |
| `ProjectIntake` | `blockedReason` | `String?` | null | Reason for blocked status |
| `ProjectIntake` | `blockedAt` | `DateTime?` | null | When it became blocked |
| `ProjectIntake` | `unblockedAt` | `DateTime?` | null | When it was unblocked |
| `ProjectIntake` | `completedAt` | `DateTime?` | null | Completion timestamp |
| `ProjectIntake` | `completedNote` | `String?` | null | Completion notes |
| `ProjectIntake` | `canceledAt` | `DateTime?` | null | Cancellation timestamp |
| `ProjectIntake` | `canceledReason` | `String?` | null | Cancellation reason |
| `ProjectIntake` | `archivedAt` | `DateTime?` | null | Archive timestamp |

`RequestStatus` enum: add `in_progress`, `blocked`, `completed`, `canceled`.

---

## Files to Create / Change

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | ADD enum values + metadata columns |
| `apps/api/prisma/migrations/...` | NEW — generated migration |
| `src/domain/lifecycle-transitions.ts` | NEW — transition map + validator |
| `src/application/intake-workflow-service.ts` | ADD executeLifecycleTransition() |
| `apps/api/src/modules/intake/intake.controller.ts` | ADD POST /intakes/:id/lifecycle/:action |
| `apps/api/src/modules/intake/dto/lifecycle-transition.dto.ts` | NEW |
| `apps/web/src/app/distributed/page.tsx` | NEW — distributed projects dashboard |
| `apps/web/src/lib/types.ts` | ADD new RequestStatus values |
| `tests/lifecycle-transitions.test.mjs` | NEW — unit tests |

---

## Tests Required

```
tests/lifecycle-transitions.test.mjs
```

| Test | Description |
|---|---|
| distributed → in_progress (valid) | mark_started succeeds |
| distributed → blocked (valid) | mark_blocked succeeds |
| distributed → completed (invalid) | Rejects with clear reason |
| in_progress → completed (valid) | mark_completed succeeds |
| in_progress → canceled (valid) | mark_canceled succeeds |
| blocked → in_progress (valid) | unblock succeeds |
| blocked → canceled (valid) | mark_canceled succeeds |
| completed → archived (valid) | archive succeeds |
| canceled → archived (valid) | archive succeeds |
| archived → anything (invalid) | Rejects with "archived records cannot be transitioned" |
| mark_blocked creates audit event | AuditEvent written with correct fields |
| mark_canceled does not delete external links | ExternalLink records preserved after cancel |
| unauthorized role rejected | Submitter role → 403 on lifecycle action |

---

## What NOT to Change

- Do not modify any provisioning, AI, or approval logic.
- Do not add Monday/GitHub sync for lifecycle updates — all transitions are manual in v1.
- Do not delete or modify `archived` status behavior for the existing pre-distribution archive path (used by rejection/archive from `intake_review` state).

---

## Open Questions (from product spec)

| ID | Question | Owner |
|---|---|---|
| Q-LIFE-001 | Who can mark a distributed project completed? DevOps Lead only, or also Intake Owner? | Admin |
| Q-LIFE-002 | Should `canceled` after distribution trigger any notification (Chat message, email)? | Product |
| Q-LIFE-003 | Should the app eventually poll Monday for milestone closed signals to auto-transition to `completed`? | DevOps |

---

## Handoff

All new statuses are additive — the existing enum values are unchanged. Metadata columns are all nullable. No existing logic is modified. The transition validator is a pure function — easy to test without a database. The UI work is a new page plus extending the existing intake detail page.

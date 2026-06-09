# TASK-0007 — Require Reviewed Package Before Gate 1 Approval

## Status: complete

## Goal

Close the governance gap left by TASK-0006: Gate 1 approval must be blocked if AI analysis drafts exist but no `ReviewedProjectPackage` has been created.

Rule:

```
If analysisDrafts.length > 0 AND reviewedProjectPackage is missing → block Gate 1.
If no analysisDrafts → Gate 1 proceeds normally (no-AI/manual path preserved).
```

## Context Read

- `docs/ai/MEMORY_INDEX.md`, `docs/ai/BUILD_LOG.md`
- `docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md`
- `src/application/intake-workflow-service.ts`
- `tests/intake-analysis-draft.test.mjs`
- `tests/analysis-review-lifecycle.test.mjs`

## Baseline

```
npm run check           → 38/38 pass
npm run demo:analysis   → pass
npm run demo:analysis-review → pass
npm run demo:mvp        → pass
```

## Implementation

### Guard added (`src/application/intake-workflow-service.ts`)

In `recordApproval`, after permission checks and before transition:

```ts
if (gate === "gate_1" && (record.analysisDrafts?.length ?? 0) > 0 && !record.reviewedProjectPackage) {
  throw new ValidationError(
    "Cannot approve intake review until an analysis draft has been accepted or revised into a reviewed project package.",
  );
}
```

Only blocks Gate 1. Gate 2 is untouched.

### Test updates

- `tests/intake-analysis-draft.test.mjs` — updated `"mock analysis cannot bypass approval or provisioning gates"` to accept draft before approving (required by TASK-0007).
- `tests/approval-reviewed-package-guard.test.mjs` — new file, 6 tests.

### Demo

- `scripts/demo-reviewed-package-approval-guard.mjs` — shows blocked-before-review and allowed-after-review.
- `demo:review-guard` script added to `package.json`.

## Tests Added

File: `tests/approval-reviewed-package-guard.test.mjs` (6 tests)

1. Gate 1 blocked when AI draft exists and no reviewed package
2. Blocked error message references reviewed package / analysis draft
3. Gate 1 succeeds after accepting draft
4. Gate 1 succeeds after revising draft
5. Gate 1 still succeeds for no-AI/manual path (no analysisDrafts)
6. Gate 2 unchanged — still works after Gate 1

## Verification

```
npm run check                 → 44/44 pass (38 original + 6 new)
npm run demo:analysis         → pass
npm run demo:analysis-review  → pass
npm run demo:review-guard     → pass
npm run demo:mvp              → pass
```

## Files Changed

```
src/application/intake-workflow-service.ts            — Gate 1 guard added
tests/intake-analysis-draft.test.mjs                  — updated (accept draft before Gate 1)
tests/approval-reviewed-package-guard.test.mjs        — new, 6 tests
scripts/demo-reviewed-package-approval-guard.mjs      — new demo
package.json                                          — added demo:review-guard script
docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md  — this file
docs/ai/BUILD_LOG.md                                  — appended
docs/ai/MEMORY_INDEX.md                               — updated
```

## Product Boundary Now Fully Enforced

```
AI drafts       → generated, immutable
Human reviews   → required before approval (TASK-0007)
Workflow approves → Gate 1 then Gate 2
System distributes → provisioning plan after both gates
```

# TASK-0014P — Intake Review: Reject → Regenerate Loop Fix

## Status

Complete

## Goal

Close the stuck-state bug at `intake_review`: rejecting an analysis draft left the
intake with no path forward to the AI. Regeneration was blocked because it required a
draft with `reviewStatus === "draft"`, but a rejected draft has `reviewStatus === "rejected"`.

The correct behaviour is a continuous loop:

```
intake_review
  → draft arrives (reviewStatus: "draft")
  → reviewer rejects (reviewStatus: "rejected", intake stays intake_review)
  → reviewer calls regenerate with guidance
  → rejected draft becomes "superseded", new draft arrives ("draft")
  → repeat up to 5 times
  → reviewer accepts or revises → reviewedProjectPackage created → gate 1
```

---

## Root Cause

`regenerateAnalysisDraft` in `intake-workflow-service.ts` searched for a draft with
`reviewStatus === "draft"` to use as the one to supersede. A rejected draft does not
match, so regeneration threw `ConflictError` immediately after any rejection, leaving
the intake stuck in `intake_review` with no AI loop escape.

---

## Changes

### `src/application/intake-workflow-service.ts`

- Changed `pendingDraft` lookup to `currentDraft`, checking `latestAnalysisDraft`
  for `reviewStatus === "draft" || reviewStatus === "rejected"`.
- Error message updated: "No draft available for regeneration. The current draft must
  be awaiting review or have been rejected."
- Supersede step, audit `previousDraftId` both updated to use `currentDraft`.
- Blocked states unchanged: `accepted` and `superseded` still prevent regeneration.

### `tests/guided-draft-regeneration.test.mjs`

- Renamed test 8 from "requires a draft in pending_review state" →
  "is blocked after draft is accepted" (more precise — rejection is now valid).
- Added test 8b: "reviewer can reject a draft then regenerate to loop back to AI"
  — verifies reject → regenerate succeeds, old draft becomes `superseded`, new draft
  is `reviewStatus: "draft"`, regen count increments.

---

## Commands Run

```bash
npm run build:core   # clean
npm test             # 380/380 pass (was 379, +1 new test)
```

---

## Invariants Preserved

- Regen limit of 5 still applies across all cycles.
- Accepted or superseded drafts still block regeneration.
- Intake status stays `intake_review` throughout the loop — no state machine change.
- Audit events written for every regeneration (previousDraftId, newDraftId, guidance, count).
- Governance boundary unchanged: AI regenerates, human still approves.

---

## Commit

`e6ca087` — fix: allow regeneration after draft rejection to close the intake_review loop

---

## Handoff

No follow-up work created by this patch. TASK-0020 (wire orchestrator into live intake
workflow) is the next planned task.

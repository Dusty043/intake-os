# TASK-0006 — Analysis Review Lifecycle

## Status: complete

## Goal

Add first-class human review of AI analysis drafts.

Enforce the product boundary:

```
AI drafts → Human reviews → Workflow approves → System distributes
```

## Context Read

- `CLAUDE.md`, `BUILD_GUIDE.md`
- `docs/ai/PROJECT_MEMORY.md`, `docs/ai/MEMORY_INDEX.md`
- `docs/ai/tasks/TASK-0005-mock-ai-analysis-draft-module.md`
- `docs/ai/decisions/ADR-0003-os-owned-orchestration-no-n8n.md`
- `src/application/intake-analysis.ts`
- `src/application/intake-workflow-service.ts`
- `src/domain/workflow.ts`, `src/domain/permissions.ts`
- `tests/intake-analysis-draft.test.mjs`

## Baseline

```
npm run check  → 28/28 pass
npm run demo:analysis  → pass
npm run demo:mvp  → pass
```

## Plan

1. Add `ReviewedProjectPackage` type and input types to `src/application/types.ts`.
2. Add `review_analysis_draft` permission to `src/domain/permissions.ts` — granted to `intake_owner`, `devops_lead`, `admin`.
3. Add `acceptAnalysisDraft`, `rejectAnalysisDraft`, `reviseAnalysisDraft` to `IntakeWorkflowService`.
4. Write `tests/analysis-review-lifecycle.test.mjs` (10 tests).
5. Write `scripts/demo-analysis-review.mjs` and add `demo:analysis-review` package script.
6. Add API DTOs and controller endpoints for accept/reject/revise.
7. Update docs.

## Implementation

### Types (`src/application/types.ts`)

Added:
- `ReviewedProjectPackage` — the immutable human-reviewed output, distinct from AI draft.
- `ReviewedProjectPackageInput` — the shape accepted from the revise action.
- `AnalysisDraftReviewDecision` — `"accepted" | "revised"`.
- `AcceptAnalysisDraftInput`, `RejectAnalysisDraftInput`, `ReviseAnalysisDraftInput`.
- `reviewedProjectPackage?: ReviewedProjectPackage` field on `ProjectIntakeRecord`.

### Permissions (`src/domain/permissions.ts`)

Added `review_analysis_draft` to `permissionActions`.

Granted to: `intake_owner`, `devops_lead`, `admin`.

Not granted to: `request_creator`, `developer`.

### Workflow service (`src/application/intake-workflow-service.ts`)

Three new methods:

- `acceptAnalysisDraft` — marks draft `accepted`, creates `ReviewedProjectPackage` from draft fields.
- `rejectAnalysisDraft` — marks draft `rejected`, no reviewed package.
- `reviseAnalysisDraft` — marks draft `superseded`, creates `ReviewedProjectPackage` from human input.

All methods:
- Check `review_analysis_draft` permission.
- Require draft `reviewStatus === "draft"` (pending review).
- Write audit events.
- Do NOT create approvals or provisioning plans.
- Return updated `ProjectIntakeRecord`.

Helper functions added:
- `requireDraft` — finds draft by ID or throws `NotFoundError`.
- `requireDraftPendingReview` — validates draft is in `"draft"` state.

Audit events written:
- `ANALYSIS_DRAFT_ACCEPTED`
- `ANALYSIS_DRAFT_REJECTED`
- `ANALYSIS_DRAFT_REVISED`
- `REVIEWED_PROJECT_PACKAGE_CREATED` (on accept and revise)

### API layer

DTOs added:
- `AcceptAnalysisDraftDto`
- `RejectAnalysisDraftDto`
- `ReviseAnalysisDraftDto`

Controller endpoints:
```
POST /intakes/:id/analysis-drafts/:draftId/accept
POST /intakes/:id/analysis-drafts/:draftId/reject
POST /intakes/:id/analysis-drafts/:draftId/revise
```

## Tests

File: `tests/analysis-review-lifecycle.test.mjs` (10 tests)

- Accept draft → reviewed package created, draft accepted, no approval/provisioning
- Reject draft → no package, draft rejected, intake stays in intake_review
- Revise draft → original draft superseded, reviewed package has human values, original preserved
- `request_creator` blocked from accept
- `request_creator` blocked from reject
- `developer` blocked from accept
- `developer` blocked from revise
- Accept does not approve intake or create provisioning plan
- Revise does not approve intake or create provisioning plan
- Cannot review a draft that is already accepted (not in draft state)

## Verification

```
npm run check          → 38/38 pass (28 original + 10 new)
npm run demo:analysis  → pass
npm run demo:analysis-review  → pass (both accept and revise paths)
npm run demo:mvp       → pass
```

## Files Changed

```
src/application/types.ts                              — added types
src/domain/permissions.ts                             — added review_analysis_draft
src/application/intake-workflow-service.ts            — added 3 review methods + helpers
tests/analysis-review-lifecycle.test.mjs              — new, 10 tests
scripts/demo-analysis-review.mjs                      — new demo
package.json                                          — added demo:analysis-review script
apps/api/src/modules/intake/dto/accept-analysis-draft.dto.ts   — new
apps/api/src/modules/intake/dto/reject-analysis-draft.dto.ts   — new
apps/api/src/modules/intake/dto/revise-analysis-draft.dto.ts   — new
apps/api/src/modules/intake/intake.controller.ts      — added 3 endpoints
docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md  — this file
docs/ai/BUILD_LOG.md                                  — appended
docs/ai/MEMORY_INDEX.md                               — updated
```

## Product Boundary Enforced

The product boundary is preserved:

```
AI analysis output is not the final project package.
It must be accepted or revised by a human reviewer before approval/distribution.
```

## Known Constraints / Not Implemented

- No live AI provider integration.
- No Google SSO.
- No n8n.
- No Monday or GitHub live provisioning.
- `api:build` may still require Prisma CLI to be installed locally.
- Gate 1 approval guard (require `reviewedProjectPackage` before approval) is optional per spec — deferred to a future task.

## Follow-up Work

- Optionally gate Gate 1 approval on existence of `reviewedProjectPackage`.
- Add `SEQUENCE_LOG.md` entry.
- Persist `reviewedProjectPackage` in Prisma schema as a JSON column when DB is active.

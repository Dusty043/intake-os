# TASK-0078 — Evaluation as source of truth on the orchestrator path (A-scoped)

**Date**: 2026-07-17

## Context

User: "ai draft and evaluation... there's a redundancy there." On the
orchestrator path (`ANALYSIS_ENGINE=orchestrator`, what the server runs),
`generateEvaluation` produced a rich `IntakeEvaluation` AND immediately
down-converted it into a legacy `IntakeAnalysisDraft` twin via
`evaluationToLegacyDraft`. Both were shown as peer tabs ("AI Draft" +
"Evaluation") and governance (accept/reject/revise) operated on the draft.

Investigation correction: `IntakeAnalysisDraft` is NOT purely a redundant
projection — it's also the native output of a separate, still-wired
single-call analysis engine (`IntakeAnalysisProvider` + mock/openai/
anthropic/bedrock adapters), used when the orchestrator isn't enabled. So
deleting the draft outright ("A-full") would amputate a live subsystem.

User chose **A-scoped**: make the evaluation authoritative on the
orchestrator path only; keep the single-call engine and its draft intact.

## Change

**Orchestrator path now treats the evaluation as the reviewable artifact —
no derived draft twin:**

- [evaluation-reviewed-package.ts](../../../src/application/evaluation-reviewed-package.ts)
  (new): `evaluationToReviewedPackage()` builds a `ReviewedProjectPackage`
  directly from evaluation sections (ports the package-relevant derivations
  from the old `evaluationToLegacyDraft`).
- [intake-workflow-service.ts](../../../src/application/intake-workflow-service.ts):
  - `generateEvaluation` saves the evaluation with `status: "ready_for_review"`
    and no longer creates/stores a draft twin.
  - `acceptAnalysisDraft` / `rejectAnalysisDraft` / `reviseAnalysisDraft` now
    branch: if a latest `ready_for_review` evaluation exists, they operate on
    it (`acceptFromEvaluation` etc., new private helpers) — accept builds the
    package from the evaluation and sets `status: "accepted"`; reject sets
    `rejected`; revise stores the human-edited package and sets `accepted`.
    Otherwise they fall back to the existing provider draft path unchanged.
  - `regenerateAnalysisDraft` (orchestrator branch) re-runs the orchestrator,
    marks the prior evaluation `needs_revision`, and saves a fresh
    `ready_for_review` evaluation (`evaluationVersion + 1`). Provider branch
    unchanged.
  - `generateMockAnalysisDraft` idempotency guard is now eval-aware on the
    orchestrator path; provider path extracted to `generateProviderDraft`.
- [types.ts](../../../src/application/types.ts): `ReviewedProjectPackage.sourceDraftId`
  is now optional + new optional `sourceEvaluationId`; review-input `draftId`
  fields are optional (omitted on the orchestrator path).
- [in-memory-store.ts](../../../src/application/in-memory-store.ts):
  `listEvaluationsForIntake` tiebreaks by `evaluationVersion` so a regenerated
  evaluation sorts ahead of the one it superseded under an identical timestamp.
- [intake.controller.ts](../../../apps/api/src/modules/intake/intake.controller.ts):
  new `POST :id/evaluation/{accept,reject,revise}` endpoints keyed by intake
  id (no draftId). Existing `:id/analysis-drafts/:draftId/*` endpoints kept.
- Web: `api-client.ts` gains `acceptEvaluation`/`rejectEvaluation`/
  `reviseEvaluation`; the intake detail page collapses to a single review
  surface — the "AI Draft" tab shows only on the provider path (draft exists
  and no evaluation); the Evaluation tab gains an Accept/Reject review bar
  (regenerate was already there). `handleAction` routes accept/reject/revise
  to the eval endpoints when there's no draft.

## Deliberately NOT done (out of A-scoped)

- The single-call provider engine, `IntakeAnalysisDraft`, and its Prisma JSON
  columns are all retained (that was A-full).
- `evaluation-draft-mapper.ts` (`evaluationToLegacyDraft` /
  `legacyDraftToEvaluation`) is now unused by application code (only the
  barrel re-export in `src/index.ts` references it). Left in place; a future
  cleanup could remove it.
- Full inline "revise" (package-edit) form on the Evaluation tab: the
  orchestrator-path revise endpoint + client exist, but the rich edit form
  currently lives only in the provider `AiDraftTab`. Accept/Reject/Regenerate
  cover the happy path; a dedicated eval revise form is a follow-up.

## Verification

`npm run build:core`, `npm run typecheck`, `npm run api:build`,
`npm --prefix apps/web run build` all clean. `npm test` — 806/806 pass
(6 tests in `generate-evaluation-service.test.mjs` rewritten to assert on the
evaluation instead of the draft twin).

**Not deployed** — dev only, per instruction. Not yet exercised against a
live OpenAI Discovery→Intake→review run; next session should accept a real
evaluation end-to-end and confirm the reviewed package + Gate 1 flow.

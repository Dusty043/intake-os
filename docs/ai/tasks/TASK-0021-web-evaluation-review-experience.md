# TASK-0021 — Web UI: Evaluation Review Experience

## Status: COMPLETE

## Goal

Expose stored `IntakeEvaluation` data in the API and web UI so reviewers can inspect the 12-agent evaluation packet behind the mapped legacy draft.

## Implementation

### API Layer

| File | Change |
|------|--------|
| `src/application/intake-workflow-service.ts` | Added `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluationForIntake` read methods |
| `apps/api/src/modules/intake/dto/evaluation.dto.ts` | New DTO: `EvaluationSummaryDto`, `toEvaluationSummaryDto()` mapper |
| `apps/api/src/modules/intake/intake.controller.ts` | Added `GET /intakes/:id/evaluations`, `GET /intakes/:id/evaluations/latest`, `GET /intakes/:id/evaluations/:evaluationId` |

### Web Layer

| File | Change |
|------|--------|
| `apps/web/src/lib/types.ts` | Added `IntakeEvaluation`, `EvaluationSection`, `EvaluationSectionProvenance`, `EvaluationSectionKind`, `IntakeEvaluationStatus`, `QualityScore`, `AgentRun`, `EvaluationSummary` types |
| `apps/web/src/lib/api-client.ts` | Added `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluation` |
| `apps/web/src/components/EvaluationPanel.tsx` | New: `EvaluationPanel`, `EvaluationSummaryCard`, `QualityScoreBadge`, `QualityScoreBreakdown`, `EvaluationRegenerateForm`, `EvaluationEmptyState` |
| `apps/web/src/components/EvaluationSectionCard.tsx` | New: `EvaluationSectionCard`, `EvaluationSectionTabs`, `AgentProvenanceFooter`, all 12 section renderers |
| `apps/web/src/app/intakes/[id]/page.tsx` | Added "Evaluation" tab; loads latest evaluation on page load; refreshes evaluation after mock_draft, regen_draft, resubmit actions |

### Tests

| File | Change |
|------|--------|
| `tests/evaluation-api-read.test.mjs` | 8 new tests: list empty, list after generate, list after regen, get latest null, get latest with runs, get by ID, wrong ID throws, agent runs populated |

## Key Design Decisions

- **No state changes**: all 3 new routes are read-only. The existing accept/reject/revise/approve flow is unchanged.
- **Evaluation loaded separately**: the page fetches evaluation in parallel to the intake load so a slow evaluation fetch doesn't block the page.
- **Regen refreshes evaluation**: after `mock_draft`, `regen_draft`, or `resubmit` actions, `loadEvaluation` is called to show the new evaluation in the Evaluation tab.
- **Section renderers by kind**: each of the 12 section kinds has a typed renderer. `FallbackRenderer` catches unknown kinds safely.
- **`!!` pattern**: all `c["key"]` conditions use `!!` to convert `unknown` to boolean for TypeScript JSX compatibility.
- **"Use as guidance" helper**: each section card has a button that prefills the full-regen form with section-specific text. Clearly labelled "reruns the full evaluation".

## Tests

398/398 pass (8 new tests in `evaluation-api-read.test.mjs`).

## Acceptance Criteria Checklist

- [x] API returns latest evaluation
- [x] API returns evaluation by ID
- [x] API lists evaluations for intake
- [x] Evaluation DTOs do not expose raw Prisma rows
- [x] Web client fetches latest evaluation
- [x] Web types include evaluation models
- [x] Intake detail page renders EvaluationPanel
- [x] Empty state when no evaluation exists
- [x] Quality score rendered
- [x] Readiness band rendered
- [x] Section tabs/cards rendered
- [x] Synthesis readable
- [x] Work breakdown readable
- [x] Risk/security readable
- [x] Distribution plan says dry-run only
- [x] Agent provenance visible (provider, model, latency, confidence %, tokens)
- [x] Confidence as percentage (stored 0–1, displayed as %)
- [x] Mock token/cost absence does not break UI
- [x] ClarificationPanel unchanged and working
- [x] Regenerate analysis with guidance available where allowed
- [x] No section-only regeneration claim
- [x] Existing accept/reject/revise flow preserved
- [x] Existing approval gates preserved
- [x] No workflow behavior changes
- [x] No Prisma schema changes
- [x] 398/398 tests pass
- [x] API build passes
- [x] Web build passes

# TASK-0020 — Wire EvaluationOrchestrator into Live Intake Workflow

## Goal

Replace the legacy `generateMockAnalysisDraft` path with the `EvaluationOrchestrator` 3-stage pipeline as the default AI evaluation engine. The orchestrator path is gated by an `ANALYSIS_ENGINE=orchestrator` environment variable so the legacy mock path remains available.

## Implementation Plan (from user)

1. Add ANALYSIS_ENGINE flag ✅
2. Add generateEvaluation service method ✅
3. Persist IntakeEvaluation + AgentRuns ✅
4. Map evaluation → legacy IntakeAnalysisDraft ✅
5. Keep old review/approval flow working ✅
6. Add clarification_required routing ✅
7. Add section regeneration ✅

## Files Changed

### Step 1-6 (this session)

| File | Change |
|------|--------|
| `src/application/types.ts` | Added `GenerateEvaluationInput` interface |
| `src/application/intake-workflow-service.ts` | Added `orchestrator` field to options + class; added `generateEvaluation` method; `generateMockAnalysisDraft` delegates to it when orchestrator is injected |
| `apps/api/src/runtime/runtime.module.ts` | `IntakeWorkflowService` factory now injects `EvaluationOrchestrator` and passes it when `ANALYSIS_ENGINE=orchestrator` |
| `tests/generate-evaluation-service.test.mjs` | 8 new tests for happy path, clarification_required, guard, and routing |

### Step 7 (section regeneration)

| File | Change |
|------|--------|
| `src/application/intake-workflow-service.ts` | `regenerateAnalysisDraft` routes to orchestrator when `this.orchestrator` is set; uses `discoveryNotes: [input.guidance]`, `allowDepthUpgrade: false`; audits as `EVALUATION_REGENERATED` |
| `tests/generate-evaluation-service.test.mjs` | 2 new tests: regen supersedes previous draft + `EVALUATION_REGENERATED` audit event |

## Key Design Decisions

- **ANALYSIS_ENGINE flag**: read in `runtime.module.ts` as `process.env["ANALYSIS_ENGINE"] === "orchestrator"`. The service itself accepts `orchestrator?: EvaluationOrchestrator` in options — no env var reads inside the domain layer.
- **Backward compat**: `generateMockAnalysisDraft` routes to `generateEvaluation` when orchestrator is injected; uses legacy `analysisProvider` path otherwise. No controller or frontend changes needed.
- **Draft persistence**: evaluation is mapped to `IntakeAnalysisDraft` via `evaluationToLegacyDraft()`, stored in `analysisDrafts` + `latestAnalysisDraft`. Existing `acceptAnalysisDraft` → `reviewedProjectPackage` → approval gates flow is unchanged.
- **Error handling on clarification**: if `ClarificationRequiredResult` is returned, transitions to `clarification_required` and audits; no draft or evaluation is persisted (partial evaluation data is not stored on clarification path — acceptable for now).

## Tests

388/388 pass (8 new tests in `generate-evaluation-service.test.mjs`).

## Status: COMPLETE (all 7 steps done)

## Open Questions

- Should section regeneration call the full orchestrator for a single section, or just the relevant agent? (deferred)
- Should `ClarificationRequiredResult` persist the partial `clarification_questions` + `intake_brief` sections so the UI can show what was missing? (deferred)
- Should the `clarification_required` state store a structured clarification record for re-submission? (deferred)

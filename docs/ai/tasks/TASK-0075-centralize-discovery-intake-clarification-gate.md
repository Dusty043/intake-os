# TASK-0075 — Centralize the Discovery↔Intake clarification gate

**Date**: 2026-07-17

## Context

Follow-up to TASK-0074. That fix bridged *context* (Discovery's free-text
`notes` now reach Intake's clarification agent) but left the actual
*criterion* split across two independently-tuned live LLM judgments:

- Discovery's exit gate: a numeric confidence threshold (`discovery.confidence_threshold`,
  default 0.65, admin-configurable) compared against 6 per-dimension scores
  from the problem-framing agent.
- Intake's gate: a boolean `isBlocking` decided entirely by a *different*
  LLM call's own qualitative judgment — no numeric threshold, no shared
  config, no relationship to the 0.65 number.

These can disagree (and did — see TASK-0074's Recipe Cost Splitter case).
User chose to centralize by making Discovery's exit gate authoritative:
before handing off, Discovery now runs the *same* clarification-blocking
check Intake uses, so Discovery can't send something Intake would
immediately re-block on.

## Change

[discovery-orchestrator.ts](../../../src/application/discovery/discovery-orchestrator.ts):
- New optional `finalClarificationCheckAgent?: EvaluationAgent<ClarificationQuestionsSectionContent>`
  on `DiscoveryOrchestratorOptions` — omitted by every existing test and any
  caller that doesn't wire it, so the gate is a no-op unless configured
  (fully backward compatible).
- `sendToEvaluation()` now builds the `intakeRecord` first (as before), then
  — if the check agent is configured — runs it against that record's
  `title`/`description`/`discovery.notes`/`priorClarifications` (new private
  `checkFinalClarification()`). If it says blocking, the intake is never
  saved: the returned questions are mapped into `ClarificationQuestion[]`
  (`required:true → impact:"blocking"`, else `"important"`), appended to the
  session, status reverts to `clarification_needed`, and `sendToEvaluation`
  returns `{ session }` with no `intakeRecord`. If not blocking, proceeds
  exactly as before, now also recording the check's token usage.
- `SendToEvaluationResult.intakeRecord` is now optional to support the
  blocked case. `discovery.controller.ts`'s `sendToEvaluation` route
  already used `intake?.id` optional chaining, so no controller change
  was needed. The web `handleSendToEvaluation` already guarded on
  `result.intakeRecord` before navigating, so no frontend change either.

[domain/discovery.ts](../../../src/domain/discovery.ts): added
`"final_clarification_check"` to `DiscoveryAgentRole` for cost-attribution.

[discovery.module.ts](../../../apps/api/src/modules/discovery/discovery.module.ts):
wires `finalClarificationCheckAgent` to the same
`OpenAIClarificationQuestionsAgent`/`MockClarificationQuestionsAgent`
Intake evaluation uses (lower-cost tier model, matching the existing
clarification/extraction row in ai-cost-governance.md's tiering table).

## Tests

`tests/discovery-final-clarification-gate.test.mjs` (new, 5 tests):
- no check agent configured → unchanged behavior
- check says not blocking → proceeds, intake created
- check says blocking → no intake, session reverts to `clarification_needed`,
  questions mapped with correct `impact`
- check agent receives intake title/description
- check agent's token usage is recorded under `final_clarification_check`
  even when it doesn't block

`npm run build:core`, `npm run typecheck`, `npm run api:build` all clean.
`npm test` — 802/802 pass (5 new).

## Product spec / requirements trace

Added B-017 to `docs/product/requirements-trace.md` (Discovery/Intake
clarification-gate parity, under `ai-orchestration.md`).

## Follow-ups

- Q-DISC-1 (other 12 evaluation agents ignoring discoveryNotes) is still
  open and unrelated to this fix.
- Not yet re-verified against a live Discovery→Intake run — next session
  should redo a vague-intent session (like Recipe Cost Splitter) live and
  confirm it now gets stopped at Discovery instead of silently passing
  through to re-block at Intake.
- This adds one extra LLM call per `sendToEvaluation` (cost tradeoff
  accepted per user's choice of "make Discovery's gate authoritative"
  over "make Intake defer to Discovery's confidence score", which would
  have added no extra call but weakened Intake's independent judgment).

# TASK: Discovery Engine — Phase 3

**Date:** 2026-06-26  
**Status:** Complete  
**Branch:** main

## Context

Phase 3 of the Discovery Engine. Built on Phase 1 (session, intent, framing) and Phase 2 (solution generation, clarification, direction selection). Adds proposal composition and evaluation handoff.

## Key design decisions

1. **`IProposalComposerAgent` receives the full `DiscoverySession`.** The composer needs the selected solution, answered clarifications, confidence scores, and problem frame — all of which live on the session. Passing the full session (vs. a narrow context struct) avoids a leaky context interface.

2. **`DimensionSlot<T>` source field distinguishes provenance.** Each dimension slot gets `source: "inferred" | "user_confirmed" | "assumed"`. Dimensions supported by answered clarification questions are upgraded to `"user_confirmed"`. Evaluators can trust higher-confidence slots more. The 12 dimensions remain suggestive, not required — all slots can be null.

3. **Completeness gate is additive, not blocking.** Unknowns and null slots surface as visible notes but never block the proposal. The gate only checks: `problemFrame.value` non-null, ≥1 functional requirement, ≥1 suggested epic. Everything else is "good-enough" for handoff.

4. **`sendToEvaluation` auto-composes if proposal not ready.** The caller can skip calling `composeProposal` explicitly. `sendToEvaluation` does it internally when `session.proposal` is null or still draft. Idempotent: if proposal is already composed, it skips.

5. **Intake adapter is a pure function, not a service.** `proposalToIntakeRecord(proposal, session, idFactory, now)` returns the record — no I/O. The caller owns persistence. This keeps the discovery layer decoupled from the `ProjectIntakeStore`. The composition root or HTTP handler persists the record.

6. **Intent type → ProjectType mapping lives in the adapter.** The mapping table (`ai_assistant → ai_workflow_tool`, `automation → n8n_automation`, etc.) is defined once in `proposal-to-intake-adapter.ts`. If new intent types or project types are added, the mapping is updated there.

## Files changed

| File | Change |
|---|---|
| `src/application/discovery/agents/mock-proposal-composer-agent.ts` | NEW |
| `src/application/discovery/proposal-to-intake-adapter.ts` | NEW |
| `src/application/discovery/agents/discovery-agent-contract.ts` | MODIFIED — `IProposalComposerAgent` added |
| `src/application/discovery/discovery-orchestrator.ts` | MODIFIED — 7th constructor arg, `composeProposal()`, `sendToEvaluation()`, `SendToEvaluationResult` |
| `src/application/discovery/discovery-controller.ts` | MODIFIED — `composeProposal()`, `sendToEvaluation()` |
| `src/application/discovery/index.ts` | MODIFIED — new exports |
| `src/application/api-composition-root.ts` | MODIFIED — `MockProposalComposerAgent` wired |
| `tests/discovery-phase-1.test.mjs` | MODIFIED — 7-arg constructor |
| `tests/discovery-phase-2.test.mjs` | MODIFIED — 7-arg constructor |
| `tests/discovery-phase-3.test.mjs` | NEW — 33 tests |

## Test results

- New: 33 tests, 33 pass
- Full suite: 671/671 pass, 0 regressions

## Handoff

Phase 4 next (not started):
- `ProvisioningManifest` generator (mock) — reads `ProjectProposal`, produces `ProvisioningManifest` with Monday/GitHub payloads
- Manifest store + run log

Phase 5 next (not started):
- Frontend three-panel UI: Discovery Timeline / Conversation / AI Understanding

Phase 6 next (not started):
- NestJS `DiscoveryModule` with HTTP routing for all discovery endpoints

Open questions:
- Should `sendToEvaluation` also trigger the existing `EvaluationOrchestrator` inline? Currently it only creates the intake record and leaves persistence to the caller. The eval trigger would need `EvaluationOrchestrator` injected into `DiscoveryOrchestrator` or a callback pattern.
- What is the correct `GenerateEvaluationInput` depth for a discovery-sourced intake? Should it always be `"full"` or should it derive from the proposal's confidence tier?

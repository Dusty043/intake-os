# TASK: Discovery Engine — Phase 2

**Date:** 2026-06-26  
**Status:** Complete  
**Branch:** main

## Context

Phase 2 of the Discovery Engine. Built on Phase 1 (session, intent extraction, problem framing). Adds solution option generation, dimension-guided clarification, and direction selection.

## Key design decisions

1. **Solution templates keyed by intent type.** Each of the 10 intent types has 2-4 domain-appropriate options. Intent type is the primary routing signal — `ai_assistant` gets knowledge-assistant/ticket-deflection options; `automation` gets workflow-automation/scheduled-script options.

2. **Clarification agent uses dimension coverage scoring.** Each of the 6 confidence dimensions (`problemUnderstanding`, `solutionFit`, `scopeClarity`, `technicalFeasibility`, `stakeholderClarity`, `downstreamMapping`) is checked against a coverage threshold (0.70). Questions are selected to target the lowest-scoring dimensions that are also decision-changing for the current intent type. Max 2 questions/turn (one blocking, one important).

3. **Intent signal ordering matters.** More specific signals (chatbot, llm, dashboard, bug) now come before general ones (automation, process) in the INTENT_SIGNALS table. First match wins — without this, "We need a chatbot to answer questions automatically" was misclassified as `automation` because "automatically" appeared first.

4. **Confidence recomputes after every clarification answer.** The answer is appended as a user message so the framing agent can re-score all 6 dimensions with the new context.

5. **`selectDirection` transitions to `direction_selected` and stores the solution id.** This sets up Phase 3 (proposal composer reads the selected solution).

## Files changed

| File | Change |
|---|---|
| `src/application/discovery/agents/mock-solution-generation-agent.ts` | NEW |
| `src/application/discovery/agents/mock-clarification-agent.ts` | NEW |
| `src/application/discovery/agents/discovery-agent-contract.ts` | MODIFIED — ISolutionGenerationAgent, IClarificationAgent, existingQuestions on context |
| `src/application/discovery/discovery-orchestrator.ts` | MODIFIED — generateSolutions, answerClarification, selectDirection |
| `src/application/discovery/discovery-controller.ts` | MODIFIED — Phase 2 controller methods |
| `src/application/discovery/index.ts` | MODIFIED — new exports |
| `src/application/api-composition-root.ts` | MODIFIED — new agents wired |
| `tests/discovery-phase-2.test.mjs` | NEW — 22 tests |
| `tests/discovery-phase-1.test.mjs` | MODIFIED — constructor call updated |

## Test results

- New: 22 tests, 22 pass
- Full suite: 638/638 pass, 0 regressions

## Handoff

Phase 3 next:
- Proposal composer agent: `ProjectProposal` generation from `DiscoverySession` + `selectedSolutionId`
- Proposal completeness gate: all required fields + visible unknowns
- Evaluation handoff adapter: `ProjectProposal` → `ProjectIntakeRecord`
- `orchestrator.sendToEvaluation(sessionId)` → transitions to `sent_to_evaluation`, triggers existing eval orchestrator

Open questions:
- Should the proposal composer try to populate the 12-dimension slots from what the discovery conversation surfaced, or just use the selected solution + problem frame directly?
- Phase 3 needs the existing `EvaluationOrchestrator` wired in — confirm injection pattern with NestJS module.

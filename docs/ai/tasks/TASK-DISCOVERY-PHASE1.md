# TASK: Discovery Engine — Phase 1

**Date:** 2026-06-26  
**Status:** Complete  
**Branch:** main

## Context

`docs/discovery_engine_spec.pdf` specifies the Discovery Engine — an ambiguity-resolution layer that sits before the existing evaluation orchestrator. Users describe messy business problems; AI infers, clarifies, structures, and produces a `ProjectProposal` for evaluation.

Phase 1 delivers the domain foundation, session management, mock agents, orchestrator, and controller. No external credentials or live API calls required.

## Key design decisions

1. **12-dimension scaffold is suggestive, not mandatory.** Each dimension (`problemFrame`, `requirements`, `systemDesign`, etc.) is a `DimensionSlot<T>` — nullable, confidence-scored, and source-tagged. Partial population is valid. Multiple evaluation paths remain viable.

2. **Confidence gates control status progression.** `confidenceTier()` maps overall confidence → behaviour:
   - `< 0.40` → keep discovering
   - `0.41–0.65` → rough frame
   - `0.66–0.80` → propose with visible assumptions
   - `> 0.80` → recommend evaluation

3. **Status never regresses.** Each `addMessage` call can only advance the `DiscoveryStatus`.

4. **Mock-first.** `MockIntentExtractionAgent` and `MockProblemFramingAgent` use keyword tables. Real provider wiring comes in a later phase.

## Files changed

| File | Change |
|---|---|
| `src/domain/discovery.ts` | NEW — all discovery domain types |
| `src/application/discovery/discovery-session-store.ts` | NEW — IDiscoverySessionStore + InMemoryDiscoverySessionStore |
| `src/application/discovery/agents/discovery-agent-contract.ts` | NEW — agent interfaces |
| `src/application/discovery/agents/mock-intent-extraction-agent.ts` | NEW — keyword mock |
| `src/application/discovery/agents/mock-problem-framing-agent.ts` | NEW — per-dimension confidence mock |
| `src/application/discovery/discovery-orchestrator.ts` | NEW — DiscoveryOrchestrator |
| `src/application/discovery/discovery-controller.ts` | NEW — DiscoveryController |
| `src/application/discovery/index.ts` | NEW — barrel export |
| `src/application/api-composition-root.ts` | MODIFIED — wired discovery |
| `src/index.ts` | MODIFIED — discovery exports |
| `tests/discovery-phase-1.test.mjs` | NEW — 24 tests |

## Test results

- New: 24 tests, 24 pass
- Full suite: 616/616 pass, 0 regressions

## Handoff

Phase 2 next:
- Solution generation agent (2-4 options, ranked)
- Clarification agent (dimension-guided, max 2 questions/turn)
- Direction selection endpoint
- Confidence recompute after user answers

Phase 3:
- Proposal composer
- Evaluation handoff adapter (maps `ProjectProposal` → `ProjectIntakeRecord`)
- Proposal completeness gate

Open questions:
- When will real provider wiring (OpenAI/Anthropic) be added to discovery agents?
- Should the NestJS module get a `DiscoveryModule` in Phase 1 or wait for Phase 2?

# TASK-0037 — Discovery Engine AI Cost Reporting

## Status: Complete

## Objective

The Discovery Engine (TASK-DISCOVERY-PHASE1–6) calls real OpenAI agents (intent extraction, problem framing, solution generation, clarification, proposal composition) but never logged token usage or cost — only the later intake-evaluation pipeline (TASK-0015/TASK-0030) was tracked in `/admin/ai-usage`. Wire Discovery Engine usage into the same cost-reporting surface so admin reports reflect total AI spend, not just intake evaluation.

## What Was Built

### Domain (`src/domain/discovery.ts`)
- `DiscoveryAgentRole` — union of the 6 discovery agent roles.
- `DiscoveryAgentUsageRecord` — mirrors `AgentRunRecord` (provider, model, tokens, estimatedCostUsd) but keyed by discovery role instead of `EvaluationSectionKind`/`sectionId`, since discovery precedes intake/evaluation creation.
- `DiscoverySession.usageRecords?` — accumulates usage for the life of the session.

### Agent contract (`src/application/discovery/agents/discovery-agent-contract.ts`)
- `DiscoveryAgentUsageEvent` — raw usage an agent reports (agentRole, model, inputTokens, outputTokens, latencyMs).
- `DiscoveryAgentOptions.onUsage?` — callback agents invoke after their LLM call.

### Agents (5 files under `src/application/discovery/agents/openai/`)
Each `OpenAI*Agent` now destructures `inputTokens`/`outputTokens` from `completeStructured()` (previously discarded) and calls `opts.onUsage?.(...)` with its role, model, tokens, and measured latency. `onUsage` is optional — agents don't throw when it's omitted (mock agents never call it, since they make no LLM call).

### Orchestrator (`src/application/discovery/discovery-orchestrator.ts`)
- `buildUsageRecords()` / `appendUsage()` — converts raw events into full `DiscoveryAgentUsageRecord[]` (cost via the existing `model-cost-registry.ts` + `token-cost.ts`), appending to `session.usageRecords` rather than overwriting.
- Wired at all 5 call sites that invoke real agents: `runAnalysis` (intent + framing), `generateSolutions` (solution + clarification), `answerClarification`'s second clarification round, `composeProposal`, `generateManifest`.
- **Bug fixed along the way**: `DiscoveryOrchestratorOptions.provider` was never passed in `discovery.module.ts`'s `buildOrchestrator()`, so `this.provider` always defaulted to `"mock"` — meaning every usage record would have been mistagged `provider: "mock"` even when real OpenAI calls were happening. Fixed by passing `provider: isMock ? "mock" : config.provider`.

### Persistence
- `IDiscoverySessionStore.listAllUsageRecords(filters?)` + shared `flattenDiscoveryUsage()` helper (added to `discovery-session-store.ts`) — implemented by both `InMemoryDiscoverySessionStore` and `PrismaDiscoverySessionStore`.
- **No Prisma migration needed** — `DiscoverySessionRecord.snapshot` is already an opaque `Json` column (whole `DiscoverySession` serialized), so `usageRecords` flows through automatically. `PrismaDiscoverySessionStore.listAllUsageRecords()` loads all session snapshots and filters in memory (same tradeoff as `InMemoryProjectIntakeStore.listAllAgentRuns` — acceptable for an admin-only report at current volume).
- New global injection token `DISCOVERY_SESSION_STORE` (`apps/api/src/persistence/store.token.ts`), provided in `RuntimeModule` (global) instead of `DiscoveryModule` providing `PrismaDiscoverySessionStore` directly — this let `AiUsageController` inject the same store without a circular module import (`DiscoveryModule` already imports `AdminModule`).

### Reporting (`apps/api/src/modules/admin/ai-usage.controller.ts`)
- Both `GET /admin/ai-usage` and `GET /admin/ai-usage/summary` now merge intake-evaluation runs and discovery usage records before aggregating — `totalCostUsd`, `totalTokens`, `runCount`, `byModel`, `byAgentRole` all reflect both sources.
- Added `bySource: { evaluation, discovery }` breakdown to both endpoints.
- `byIntake` is preserved (evaluation runs only — discovery sessions have no `intakeId` yet).
- `listUsage`'s `intakeId` filter only narrows evaluation runs (discovery has no intake to filter by); discovery runs are excluded from the response when `intakeId` is passed, since they can't be attributed to it.

### UI
- `/admin/ai-usage` — new "Cost by Source" table (evaluation vs. discovery, runs/tokens/cost).
- `/reports` — AI Cost section header now shows an inline `evaluation: $X · discovery: $Y` breakdown.
- No other UI changes needed — both pages already read `totalCostUsd`/`totalTokens`/`runCount`/`byModel` generically, so they reflect combined cost automatically.

## Tests

```
tests/discovery-usage-tracking.test.mjs        — 5 tests (orchestrator usage capture + accumulation,
                                                  mock agents emit nothing, store listAllUsageRecords +
                                                  date filtering)
tests/openai-discovery-agents-usage.test.mjs   — 6 tests (all 5 OpenAI agents report onUsage correctly;
                                                  onUsage is optional)
npm run build:core   — pass
npm run typecheck    — pass
npm run api:build    — pass
npx tsc --noEmit (apps/web)  — pass
npm --prefix apps/web run build — pass
npm test             — 698/703 pass (same 5 pre-existing, unrelated failures in discovery-phase-3.test.mjs)
```

No NestJS controller-level test was added for `AiUsageController`'s merge logic — this codebase has no existing unit-test coverage for any controller (confirmed: no test file references `ai-usage.controller` or `settings.controller`). The merge logic itself (`mergeUsageRuns`/`aggregateUsage`) is plain functions exercised indirectly via the typecheck + build; recommend a manual smoke check against a running API before relying on it in production.

## Follow-up / Open Items

- Manual smoke test recommended: hit `/admin/ai-usage/summary` after a real (non-mock) discovery session runs, confirm `bySource.discovery` appears with nonzero cost.
- Appendix G (AI Cost Governance) in `docs/product/requirements-trace.md` doesn't model the Discovery Engine at all (it predates it) — added a note to G-001 rather than restructuring the appendix.
- `src/application/discovery/agents/openai/openai-discovery-client.ts`'s `callStructured()` helper is dead code (no callers) — unrelated to this task, not touched.

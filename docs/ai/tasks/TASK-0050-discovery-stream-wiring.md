# TASK-0050 Discovery live-streaming (Q-UX-1) — T3: wire real streaming through the LLM client

## Request

Continuation of TASK-0048/0049 (Q-UX-1). T3 per the eng-reviewed design doc: wire `stream: true` + token forwarding through the shared `OpenAILlmClient.completeStructured`, so the SSE route (T2) carries real content instead of only test-published events. All 6 Discovery agents go through this one shared call site, so this is the single choke point for the change — not 6 separate edits.

## Context Read

- [x] Design doc (`~/.gstack/projects/Dusty043-intake-os/oreo-main-design-20260710-003932.md`) — Implementation Task T3
- [x] `docs/ai/tasks/TASK-0048-discovery-live-streaming.md`, `TASK-0049-discovery-sse-controller.md`
- [x] `src/application/llm-client.ts`, `src/application/providers/openai-llm-client.ts` — confirmed the shared `completeStructured` abstraction and its 4 implementations (OpenAI, Anthropic, Bedrock, mock)
- [x] `src/application/discovery/agents/discovery-agent-contract.ts` — confirmed `completeWithUsage` is the single wrapper every real Discovery agent calls
- [x] Confirmed via grep: `OpenAiLlmClient` has zero existing tests/mocks anywhere in the repo — safe to change its internals since nothing asserts on its current request shape
- [x] Confirmed `src/application/agents/openai/*` (the separate, out-of-scope evaluation pipeline) also goes through `createLlmClient`/`OpenAiLlmClient`, but only Discovery agents pass `onToken`/`onStreamEvent` — evaluation's observable behavior is unchanged (same final result), only the internal request shape changes for both (always streams now)

## Plan

1. Add optional `onToken?: (text: string) => void` to `StructuredCompletionParams` (`llm-client.ts`) — every implementation ignores it unless it chooses to support it.
2. Implement real streaming in `OpenAiLlmClient.completeStructured`: `stream: true` + `stream_options: { include_usage: true }`, accumulate `delta.content` fragments (calling `onToken` per fragment), capture `finish_reason` and `usage` from whichever chunk carries them, parse the accumulated text exactly as before. Anthropic/Bedrock/mock clients untouched — they simply don't implement token forwarding.
3. Add optional `onStreamEvent?: (event: DiscoveryStreamEvent) => void` to `DiscoveryAgentOptions` (`discovery-agent-contract.ts`), reusing the `DiscoveryStreamEvent` type from T1's registry (not inventing a duplicate type).
4. `completeWithUsage` brackets each call: `stage-start` before, `token` per chunk (forwarded from `onToken`), `stage-end` after success, `error` (no `stage-end`) on throw.
5. `DiscoveryOrchestrator`: add optional `streamRegistry` to its options/constructor; `trackUsage` takes `sessionId` and wires `onStreamEvent` to `registry.publish(sessionId, event)` when a registry is configured. Update all 5 call sites (`runAnalysis`, `generateSolutions`, `answerClarification`, `composeProposal`, `generateManifest`) to pass `sessionId`.
6. `discovery.module.ts`: inject the already-registered `DiscoveryStreamRegistry` (T2) into the orchestrator via `buildOrchestrator`.
7. Tests: unit-test `completeWithUsage`'s event bracketing directly (success, failure, and no-`onStreamEvent` backward-compat paths) with a fake `LlmClient` — this repo has no infra to unit-test the raw OpenAI SDK integration (confirmed no existing tests do this), so streaming is verified at the `completeWithUsage`/orchestrator layer, same pattern as the rest of this codebase's agent tests (Mock agents never touch the real client).

## Changes

- `src/application/llm-client.ts` — added `onToken` to `StructuredCompletionParams`.
- `src/application/providers/openai-llm-client.ts` — `completeStructured` now always streams internally (`stream: true`); calls `onToken` per delta, accumulates for final parse.
- `src/application/discovery/agents/discovery-agent-contract.ts` — added `onStreamEvent` to `DiscoveryAgentOptions`; `completeWithUsage` brackets stage-start/token/stage-end/error.
- `src/application/discovery/discovery-orchestrator.ts` — `DiscoveryOrchestratorOptions.streamRegistry` (optional); `trackUsage(sessionId, base)` wires `onStreamEvent`; all 5 call sites updated to pass `sessionId`.
- `apps/api/src/modules/discovery/discovery.module.ts` — `buildOrchestrator` now takes and forwards the `DiscoveryStreamRegistry` provider.
- `tests/discovery-stream-wiring.test.mjs` (new) — 5 tests.

## Commands Run

```bash
npm run build:core                                          # clean
npx tsc --noEmit -p apps/api/tsconfig.json                   # clean
node --test tests/discovery-stream-wiring.test.mjs           # 5/5 pass
npm test                                                      # 773/774 pass; same pre-existing unrelated failure
node --test dist/apps/api/src/modules/discovery/discovery-stream.e2e-spec.js   # 3/3 pass (re-verified after module changes)
```

## Test Results

5/5 new tests pass. Full core suite: 773/774 (same pre-existing unrelated `tests/monday-config.test.mjs` failure). T2's e2e-spec re-verified passing after this task's changes to `discovery.module.ts`.

## Decisions

- **`OpenAiLlmClient.completeStructured` always streams internally now, regardless of whether `onToken` is passed.** One implementation serves both Discovery (which passes `onToken`) and the out-of-scope evaluation pipeline (which doesn't) — avoids duplicating ~30 lines of near-identical logic into a second method, matching the DRY preference. Confirmed via grep this class has zero existing tests/mocks, so nothing could break from changing its internal request shape; the external contract (`StructuredCompletionResult`) is identical either way.
- **`onToken`/`onStreamEvent` reuse `DiscoveryStreamEvent` from T1's registry rather than a parallel type.** `discovery-agent-contract.ts` imports the type directly — one definition, not two shapes that could drift.
- **No new tests for the raw OpenAI SDK streaming loop itself.** This repo has no seam to inject a fake `OpenAI` client into `OpenAiLlmClient` (constructor does `new OpenAI({apiKey})` internally) and no existing test does this for the non-streaming code path either — consistent with the existing test strategy (Mock agents bypass the real client entirely; `completeWithUsage`'s bracketing logic is what's actually new and testable, and is tested directly).

## Open Questions

None new. T4 (frontend `fetch`+`ReadableStream` consumer) is next — it can now display real content, not just test-published events, once wired to the T2 route.

## Handoff

T3 complete. The full backend pipeline works end-to-end: a real Discovery turn with a configured OpenAI provider now streams `stage-start`/`token`/`stage-end` events per agent call into the `DiscoveryStreamRegistry`, which the T2 SSE route forwards to any subscribed browser. Nothing on the frontend consumes this yet — `DiscoveryChat.tsx` still shows the static "AI is thinking…" pulse. T4 is the task that replaces it.

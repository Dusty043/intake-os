# TASK-0048 Discovery live-streaming (Q-UX-1) — T1: DiscoveryStreamRegistry

## Request

Implement Q-UX-1 (surface AI reasoning/progress during Discovery sessions) per the approved, eng-reviewed design doc at `~/.gstack/projects/Dusty043-intake-os/oreo-main-design-20260710-003932.md`. Building incrementally per the doc's Implementation Tasks (T1-T6); this task covers T1 only, per the doc's explicit Assignment: build the `DiscoveryStreamRegistry` first, in isolation, with its own test coverage, before wiring any agent to it.

## Context Read

- [x] `CLAUDE.md`
- [x] `docs/ai/OPEN_QUESTIONS.md` (Q-UX-1)
- [x] Design doc (`~/.gstack/projects/Dusty043-intake-os/oreo-main-design-20260710-003932.md`) — full design + eng review + outside-voice corrections
- [x] `src/application/discovery/discovery-orchestrator.ts` (integration point for later tasks)
- [x] `src/application/discovery/agents/discovery-agent-contract.ts`, `src/application/providers/openai-llm-client.ts` (shared LLM abstraction, for later tasks)

## Plan

1. Add `DiscoveryStreamRegistry` — session-scoped subscribe/publish event bus, no dependencies on the orchestrator or any agent.
2. Export it from the `discovery` barrel (`src/application/discovery/index.ts`) matching this repo's existing export pattern.
3. Unit tests matching the Test Plan diagram's registry coverage: no-subscriber no-op, delivery to subscriber, session isolation, multiple listeners per session (two-tabs case), unsubscribe scoping, cleanup on last-listener-leave, error-event delivery.
4. Build + run full suite, confirm no regressions.
5. Stop here — T2 (SSE controller + auth) and T3 (wiring the registry into the orchestrator/agents) are separate follow-up tasks per the design doc's phasing.

## Changes

- `src/application/discovery/discovery-stream-registry.ts` (new) — `DiscoveryStreamRegistry` class with `subscribe`/`publish`/`hasSubscribers`.
- `src/application/discovery/index.ts` — added barrel export.
- `tests/discovery-stream-registry.test.mjs` (new) — 7 unit tests.

## Commands Run

```bash
npm run build:core   # clean
node --test tests/discovery-stream-registry.test.mjs   # 7/7 pass
npm test              # 768/769 pass; 1 pre-existing failure (tests/monday-config.test.mjs) unrelated to this change — untracked file from a different in-progress session, confirmed via git stash that the failure exists independent of this change
```

## Test Results

7/7 new tests pass. Full suite: 768/769 pass. The one failure (`tests/monday-config.test.mjs`) is pre-existing, unrelated work-in-progress (untracked `src/application/provisioning/monday-config.ts` from a separate session) — not touched by this task.

## Decisions

- In-memory `Map`-based registry, single-process only (`ponytail` comment in the file names the ceiling and the upgrade path: swap for Redis pub/sub behind the same API if horizontally scaled later). Matches this app's current single-instance deployment (`docker-compose.server.yml`) — no need to build for scale that doesn't exist.
- `publish()` is a no-op when there's no subscriber, rather than throwing or requiring callers to check `hasSubscribers()` first — keeps the future orchestrator integration (T3) simple: it can always call `publish()` unconditionally.
- Multiple listeners per session supported via a `Set` — needed for the two-tabs-open case the outside-voice review flagged as a correctness risk elsewhere in the design; the registry itself handles this correctly by construction (each tab's listener gets every event independently).

## Open Questions

None new. Design doc's remaining open item (`generateSolutions`/`planClarifications` concurrency — serialize vs. multi-indicator UI) is unaffected by this task and still needs a decision before T3.

## Handoff

T1 complete and tested in isolation, as instructed. Next: T2 (SSE controller with `requireOwnedSession` auth check + first `*.e2e-spec.ts` in this repo) or T3 (wire `stream: true` through `OpenAILlmClient.completeStructured`, forwarding into this registry) — either can start now; T4 (frontend) can also start in parallel per the design doc's worktree parallelization lanes, since it only needs the already-defined wire protocol, not this implementation.

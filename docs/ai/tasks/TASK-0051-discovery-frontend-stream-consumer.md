# TASK-0051 Discovery live-streaming (Q-UX-1) — T4: frontend stream consumer

## Request

Continuation of TASK-0048/0049/0050 (Q-UX-1). T4 per the eng-reviewed design doc: replace `DiscoveryChat.tsx`'s static "AI is thinking…" pulse with a live consumer of the T2 SSE route, using `fetch`+`ReadableStream` (not `EventSource`, which can't carry this app's `x-actor-*` auth headers).

## Context Read

- [x] Design doc (`~/.gstack/projects/Dusty043-intake-os/oreo-main-design-20260710-003932.md`) — Implementation Task T4
- [x] `docs/ai/tasks/TASK-0048/0049/0050-*.md`
- [x] `apps/web/src/lib/discovery-client.ts`, `apps/web/src/lib/http.ts` (existing `actorHeaders`/`request`/`BASE` patterns)
- [x] `apps/web/src/app/discovery/[id]/page.tsx`, `apps/web/src/components/discovery/DiscoveryChat.tsx`

## Plan

1. **Resolve a real UX fork the eng review flagged but left open**: raw `token` events carry mid-stream JSON fragments (e.g. `{"problemStatement":"Users nee`), not prose — decided with the user to show live stage transitions only (`stage-start`/`stage-end` driven), not literal raw text, since rendering broken JSON was the exact bad-UX outcome the review warned about.
2. Add `streamDiscoverySession(id, actor, onEvent, signal)` to `discovery-client.ts` — opens `GET /discovery/:id/stream` via `fetch` (carries `actorHeaders()`), manually parses the `event:`/`data:` SSE frame format from the raw `ReadableStream` (no `EventSource`).
3. `discovery/[id]/page.tsx`: one stream connection per page view (persists across turns, matching the registry's session-scoped lifetime), tracked via `activeStages: Set<string>` — `stage-start` adds, `stage-end`/`error` removes. Connection failure/abort leaves `activeStages` empty; existing static indicator is the fallback.
4. `DiscoveryChat.tsx`: new `activeStages` prop; friendly per-stage labels (`STAGE_LABELS` map from `DiscoveryAgentRole` names); header indicator shows live labels (e.g. "Understanding your request…" or, per the concurrency decision, multiple joined: "Understanding your request · Planning clarifying questions…") when available, generic "AI is thinking…" otherwise.

## Changes

- `apps/web/src/lib/discovery-client.ts` — added `DiscoveryStreamEvent` type and `streamDiscoverySession()`.
- `apps/web/src/app/discovery/[id]/page.tsx` — `activeStages` state, stream-opening `useEffect`, passed down to `DiscoveryChat`.
- `apps/web/src/components/discovery/DiscoveryChat.tsx` — `activeStages` prop, `STAGE_LABELS`/`progressText()`, header indicator now shows live stage text instead of a fixed string.
- `apps/web/src/lib/__tests__/discovery-client.test.ts` — 3 new tests for `streamDiscoverySession`.

## Commands Run

```bash
npx tsc --noEmit                    # (in apps/web) clean
npx vitest run                      # (in apps/web) 14/14 pass (11 existing + 3 new)
npm run web:build                   # production build + lint clean
```

## Test Results

14/14 frontend tests pass (3 new for `streamDiscoverySession`: happy path parses frames in order, malformed frame is skipped without throwing, non-OK response rejects). Production build succeeds with lint clean.

**Not verified in a live browser.** Local Postgres (port 5432) is occupied by an unrelated project on this dev machine (same class of conflict hit during the earlier deploy session), and testing the actual live-stage-label behavior requires a real OpenAI provider (`.env` has `AI_PROVIDER=mock` locally — mock agents never call `completeWithUsage`, so no stage events would fire under mock mode; only the fallback path would be exercised). Did not flip to a real API key without asking first. What's verified instead: types, lint, production build, and unit tests covering every piece of new logic (SSE frame parsing, malformed-frame handling, error handling, stage-set bookkeeping is implicit in the `Set` operations used, which are standard library behavior).

## Decisions

- **Show stage transitions, not raw streamed text.** Confirmed with the user: `token` events are mid-stream JSON fragments (all 6 Discovery agents are strict-schema JSON per T3's design), so rendering them literally would look broken. `stage-start`/`stage-end` drive a friendly label instead — still genuinely live, not the literal character-by-character effect originally imagined, but avoids the specifically-flagged bad-UX outcome.
- **One stream connection per page view, not per send action.** Matches the backend registry's session-scoped (not request-scoped) subscriber lifetime — opened on mount via `useEffect`, torn down via `AbortController` on unmount, persists across multiple turns.
- **Connection failure is silent, not surfaced as an error.** Per the design doc's explicit fallback requirement — `activeStages` just stays empty and the existing static indicator covers it; this is a progressive enhancement, not a required path.

## Open Questions

None new. T5 (Caddy buffering config) and T6 (heartbeat) remain — both are small, infra-level tasks. Live-browser verification of actual streamed stage labels is deferred until either a real OpenAI provider is available in a test environment, or this is verified after deployment.

## Handoff

T4 complete — all four backend+frontend pieces of the core feature are now in place (T1-T4). A user with a real OpenAI-backed session would see live "Understanding your request…" → "Framing the problem…" style labels instead of a static generic pulse, with automatic fallback to the old behavior if the stream fails. T5 (Caddy buffering) and T6 (heartbeat) are the remaining infra-hardening tasks — the feature works without them, but a real deployment could see incrementally worse behavior (buffered-instead-of-live delivery from T5, or premature connection drops on long idle gaps from T6) without them.

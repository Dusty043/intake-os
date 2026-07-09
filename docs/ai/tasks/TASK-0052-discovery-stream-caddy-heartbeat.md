# TASK-0052 Discovery live-streaming (Q-UX-1) — T5 + T6: Caddy buffering + heartbeat

## Request

Final two tasks per the eng-reviewed design doc, completing Q-UX-1's full implementation: T5 (disable response buffering in production Caddy for the SSE route) and T6 (periodic heartbeat so idle gaps between stages don't get the connection dropped).

## Context Read

- [x] Design doc (`~/.gstack/projects/Dusty043-intake-os/oreo-main-design-20260710-003932.md`) — Implementation Tasks T5, T6
- [x] `docs/ai/tasks/TASK-0048/0049/0050/0051-*.md`
- [x] `deploy/Caddyfile.server` — confirmed no existing flush/buffering directives

## Plan

1. **T5**: add `flush_interval -1` to the API `reverse_proxy` block in `deploy/Caddyfile.server` — flushes every write immediately instead of buffering, required for SSE chunks to arrive live through the proxy. Validate with `caddy validate`/`caddy fmt` via the `caddy:2` Docker image (no local Caddy CLI).
2. **T6**: heartbeat event (not a raw SSE comment line as the design doc originally sketched — an actual named `heartbeat` event on the same Observable is simpler and the frontend already ignores unrecognized event types) emitted every 15s during the SSE connection's lifetime via `setInterval`, torn down alongside the registry unsubscribe.
3. Make the interval duration injectable (`@Optional() @Inject(DISCOVERY_STREAM_HEARTBEAT_MS_TOKEN)`) so a test can use a short real interval instead of the production 15s value — first attempt used `node:test`'s fake timers (`t.mock.timers`), which deadlocked against the live HTTP stream (documented as a dead end, not used).
4. Update the frontend's `DiscoveryStreamEvent` type for completeness (heartbeat events flow to the client even though they never touch the backend registry).

## Changes

- `deploy/Caddyfile.server` — `flush_interval -1` on the API reverse_proxy block; reformatted via `caddy fmt --overwrite`.
- `apps/api/src/modules/discovery/discovery.controller.ts` — heartbeat `setInterval` in the SSE Observable's subscriber, torn down on unsubscribe; `DISCOVERY_STREAM_HEARTBEAT_MS_TOKEN` (optional DI override, test-only).
- `apps/api/src/modules/discovery/discovery-stream.e2e-spec.ts` — 1 new test (heartbeat fires on an idle connection), using a 30ms real interval via the injectable token.
- `apps/web/src/lib/discovery-client.ts` — added `{ type: "heartbeat" }` to `DiscoveryStreamEvent`.

## Commands Run

```bash
docker run --rm -v .../Caddyfile.server:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile   # Valid
docker run --rm -v .../Caddyfile.server:/etc/caddy/Caddyfile caddy:2 caddy fmt --overwrite /etc/caddy/Caddyfile        # reformatted, re-validated clean
npm run api:build && npx tsc --noEmit -p apps/api/tsconfig.json   # clean
node --test dist/apps/api/src/modules/discovery/discovery-stream.e2e-spec.js   # 4/4 pass, x5 runs — stable
npm run build:core && npm test                                    # 773/774 pass, same pre-existing unrelated failure
```

## Test Results

4/4 e2e tests pass (3 from T2 + 1 new heartbeat test), stable across 5 repeated runs. Caddyfile validated with the real `caddy:2` binary via Docker (no local Caddy CLI on this machine). Full core suite unaffected.

## Decisions

- **Heartbeat is a named `heartbeat` event on the existing Observable, not a raw `: heartbeat\n\n` SSE comment line** as the design doc originally sketched. NestJS's `@Sse()` + `MessageEvent` abstraction has no first-class support for comment-only frames (its `SseStream` transform always emits based on `type`/`data` fields) — going lower-level to bypass that would abandon the clean Observable pattern this route is built on. A named event achieves the identical keep-alive purpose (a chunk is written, resetting any idle timer) and the frontend's event-type switch already has an implicit no-op fallthrough for anything that isn't `stage-start`/`stage-end`/`error`.
- **Fake timers (`t.mock.timers`) do not compose safely with a live HTTP stream in this stack** — enabling them and calling `.tick(15_000)` deadlocked the test process (had to be killed). Documented as a dead end rather than silently abandoned, so a future session doesn't re-attempt the same approach. Replaced with an injectable heartbeat interval so the test can use a real 30ms interval instead — a few extra lines of DI plumbing, but avoids both the deadlock risk and a slow real-15-second test.
- **Caddy validated via Docker, not installed locally** — this machine has no Caddy CLI; used the same `caddy:2` image already pinned in `docker-compose.server.yml` rather than installing a new local tool for a one-time check.

## Open Questions

None new. All 6 implementation tasks (T1-T6) from the design doc are now complete. Remaining known gap: the feature has never been exercised in a live browser (see TASK-0051's handoff) — local Postgres port conflict + no real OpenAI provider configured locally.

## Handoff

Q-UX-1 is fully implemented (T1-T6) on branch `feat/discovery-live-streaming`, 5 commits, all automated tests passing. What's NOT done: live-browser verification with a real OpenAI provider, and no PR has been opened yet. Recommend: open a PR referencing this task chain (TASK-0048 through TASK-0052) and the design doc, and do a live smoke test — either locally with a real `OPENAI_API_KEY` (`AI_PROVIDER=openai` in `.env`) after resolving the Postgres port conflict, or after deploying to oreochiserver where the real provider is already configured.

# TASK-0049 Discovery live-streaming (Q-UX-1) — T2: SSE controller + auth

## Request

Continuation of TASK-0048 (Q-UX-1). T2 per the eng-reviewed design doc: add the `GET /discovery/:id/stream` SSE route with the same `requireOwnedSession` ownership check every other `:id` route uses, and establish this repo's first NestJS controller-level e2e test (`@nestjs/testing` + `supertest`) to verify it — no controller-level HTTP test existed anywhere in `apps/api` before this.

## Context Read

- [x] Design doc (`~/.gstack/projects/Dusty043-intake-os/oreo-main-design-20260710-003932.md`) — Implementation Task T2
- [x] `docs/ai/tasks/TASK-0048-discovery-live-streaming.md` (T1, prerequisite)
- [x] `apps/api/src/modules/discovery/discovery.controller.ts`, `discovery.module.ts`
- [x] `apps/api/src/modules/auth/auth.guard.ts`, `session.service.ts` — confirmed `AUTH_MODE=dev_headers` (default) never touches `SessionService`, so a stub is safe for this test
- [x] `apps/api/src/common/application-exception.filter.ts` — confirmed `NotFoundError` → 404 mapping, registered globally via `APP_FILTER` in `RuntimeModule` (not included in this minimal test module by default — added explicitly)

## Plan

1. Add `GET /discovery/:id/stream` using NestJS's `@Sse()` decorator, calling `requireOwnedSession` before subscribing to the registry (from T1).
2. Register `DiscoveryStreamRegistry` as a provider in `DiscoveryModule`.
3. Install `@nestjs/testing`, `supertest`, `@types/supertest` (none existed in this repo).
4. Write `apps/api/src/modules/discovery/discovery-stream.e2e-spec.ts` — a minimal standalone Nest testing module (not the full `AppModule`, to avoid pulling in `PrismaService`/real DB): real `AuthGuard` + real `ApplicationExceptionFilter` (both load-bearing for what this test verifies), stubbed `SessionService`/`IntakeWorkflowService`/app-layer `DiscoveryController`.
5. Add `api:test:e2e` npm script (build + `node --test` against compiled e2e-specs) so this pattern is reusable, not a one-off.

## Changes

- `apps/api/src/modules/discovery/discovery.controller.ts` — added `streamSession()` route (`GET :id/stream`, `@Sse()`), injected `DiscoveryStreamRegistry`.
- `apps/api/src/modules/discovery/discovery.module.ts` — registered `DiscoveryStreamRegistry` as a provider.
- `apps/api/src/modules/discovery/discovery-stream.e2e-spec.ts` (new) — 3 e2e tests.
- `package.json` — added `@nestjs/testing`, `supertest`, `@types/supertest` devDependencies; added `api:test:e2e` script.

## Commands Run

```bash
npm install --save-dev @nestjs/testing supertest @types/supertest
npm run api:build                                        # clean
npx tsc --noEmit -p apps/api/tsconfig.json                # clean
node --test dist/apps/api/src/modules/discovery/discovery-stream.e2e-spec.js   # 3/3 pass, x5 runs for flake-check — stable
npm test                                                  # 768/769 pass; same pre-existing unrelated failure as TASK-0048 (tests/monday-config.test.mjs)
```

## Test Results

3/3 new e2e tests pass, stable across 5 repeated runs (timing-sensitive SSE test — verified not flaky). Full suite unaffected: same single pre-existing unrelated failure as TASK-0048.

## Decisions

- **Test module deliberately does NOT reuse the full `DiscoveryModule`/`AppModule`.** `DiscoveryModule` imports `AdminModule` → `GlobalSettingsService` → `PrismaService` (real DB) — pulling that in would make this a DB-dependent integration test instead of a fast, isolated controller test. Built a minimal `Test.createTestingModule` instead, with the *real* `AuthGuard` and `ApplicationExceptionFilter` (both load-bearing for what's being verified) and stubs for everything else.
- **Real `AuthGuard` included, not a fake auth middleware.** Confirmed `AUTH_MODE=dev_headers` (this app's default) never calls `SessionService`, so a `{}` stub is safe — this means the test exercises the actual production auth path (header parsing → actor resolution → ownership check), not a test-only substitute that could drift from real behavior.
- **SSE round-trip test uses a custom supertest `.parse()` + `waitForSubscriber()` poll** (not a fixed `setTimeout`) to know when the server-side subscription is live before publishing test events — avoids a flaky fixed-delay race. Verified stable across 5 runs.

## Open Questions

None new. T3 (wiring `stream: true` through the real LLM client, forwarding into this registry) is next per the design doc.

## Handoff

T2 complete. The SSE route works end-to-end (auth check + event framing verified by a real HTTP round-trip), but nothing publishes real events into the registry yet — `discovery-orchestrator.ts` and the 6 OpenAI agent files are untouched. T3 is the task that makes this route carry real content instead of only test-published events.

# TASK-0046 — Unit Tests for PrismaDiscoverySessionStore Optimistic Concurrency

**Date:** 2026-07-07
**Status:** implemented

## Context

`PrismaDiscoverySessionStore.update()` (`apps/api/src/persistence/prisma-discovery-session-store.ts`)
uses optimistic concurrency: compare-and-swap on `updatedAt` via `updateMany`,
retrying up to 3 times, throwing `ConflictError` on exhaustion. No test harness
existed for `apps/api` persistence adapters — the `tests/*.test.mjs` suite only
covers `dist/src/...` core modules built via `npm run build:core`.

## Approach

Checked for an existing apps/api test pattern first — none found (`find
apps/api -iname "*.test.*"` returned nothing). Followed the existing
`tests/*.test.mjs` convention (import from compiled `dist/`, plain
`node:test` + `node:assert/strict`, no mocking library) rather than
introducing a new framework or a TS-source test loader.

`npm run api:build` compiles `apps/api` (plus `src/`) into
`dist/apps/api/src/...`. Added the test at `tests/api/prisma-discovery-session-store.test.mjs`
— a subdirectory, not `tests/*.test.mjs` directly, so the existing `npm test`
script (`build:core` only, no `api:build`) is unaffected. Added a
`test:api` script (`api:build && node --test tests/api/*.test.mjs`) as the
runnable entry point for this and future apps/api persistence tests.

`PrismaService` is mocked as a plain object (`discoverySessionRecord.findUnique`/
`updateMany`) using small hand-rolled tracking functions rather than
`node:test`'s `mock.fn()`, to avoid version-specific mock API assumptions.

## Tests Added (`tests/api/prisma-discovery-session-store.test.mjs`)

1. Normal update: `updateMany` returns `count: 1` on the first attempt →
   returns the merged session, `findUnique`/`updateMany` each called once.
2. Retry: `updateMany` returns `count: 0` on attempts 1–2, `count: 1` on
   attempt 3, with a distinct snapshot returned by `findUnique` on each call →
   `update()` retries 3 times and the result reflects attempt 3's fresh
   snapshot (not attempt 1's stale one).
3. Exhaustion: `updateMany` returns `count: 0` on all 3 attempts → `update()`
   throws `ConflictError`, both mocks called exactly 3 times.

## Testing

- `npm run test:api` — **3/3 passing**.
- `npm test` — unaffected, still **745/769 passing** (the 24 failures are
  pre-existing in `tests/provisioning-scheduled-retry.test.mjs` and unrelated
  to this change; not investigated further as out of scope for this task).

## Not Changed

- No application code in `prisma-discovery-session-store.ts` — test-only
  addition.
- Did not investigate or fix the 24 pre-existing `npm test` failures.

## Follow-up

- If more apps/api persistence adapters get test coverage, they belong under
  `tests/api/` alongside this one, using `npm run test:api`.

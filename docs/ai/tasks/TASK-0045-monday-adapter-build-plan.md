# TASK-0045 — Monday Adapter Build Plan

**Status:** IN PROGRESS — Step 1 complete. Steps 2–5 blocked on credentials (see below).
**Plan date:** 2026-07-06
**Depends on:** TASK-0023D-monday-adapter.md (spec of record — this doc does not repeat its acceptance criteria, error table, or idempotency rules; read it first), TASK-0038 (board schema confirmed).

---

## Blockers to confirm before writing code

TASK-0023D lists four required env vars. Two are already in `.env.example` / `.env`:

- `MONDAY_API_TOKEN` — present
- `MONDAY_BOARD_ID` — present

Two are **not yet in `.env.example` at all**:

- `MONDAY_GROUP_ID`
- `MONDAY_COLUMN_MAP_JSON`

Per TASK-0023D: "Do not start implementing until these are confirmed." Get the group ID and column mapping from whoever owns the Dev Operations Workspace board (same source as TASK-0038's manager's guide) before starting Step 2 below. Step 1 (config schema) can proceed without them — it just defines the shape.

Also note: `LIVE_PROVISIONING_ENABLED` already exists in `.env.example` but nothing in `runtime.module.ts` reads it — it's currently a dead flag. This plan retires it in favor of `PROVISIONING_TARGETS` (see Step 4), since TASK-0023D's acceptance criteria reference `PROVISIONING_TARGETS` explicitly, not `LIVE_PROVISIONING_ENABLED`.

---

## Current state (grounding, not spec)

- `ProvisioningRegistry` / `ProvisioningExecutor` (`src/application/provisioning/provisioning-executor.ts`) is the real interface — stable, no changes needed.
- `runtime.module.ts` unconditionally builds `createMockRegistry(executorMode)` (`src/application/provisioning/mock-executor.ts`) — there is no branch for a real executor today. This is the integration point Step 4 changes.
- No `monday-executor.ts`, `monday-api-client.ts`, or `monday-config.ts` exist yet.

---

## Implementation steps (TDD order — each step RED before GREEN)

1. **`monday-config.ts`** — env schema + validation only, no network calls. **DONE** (2026-07-06).
   - Parses the four env vars, validates `MONDAY_COLUMN_MAP_JSON` as JSON, throws a clear startup error naming the missing/malformed var.
   - Test: valid env → parsed config object; missing/malformed var → throws with the var name in the message.
   - Implemented in `src/application/provisioning/monday-config.ts`, exported from `src/index.ts`. Rejects non-object `MONDAY_COLUMN_MAP_JSON` (e.g. an array) in addition to malformed JSON, since the spec's `{ column_id: field_source }` shape requires an object. 9 unit tests in `tests/monday-config.test.mjs`. Not yet wired into `runtime.module.ts` — that's Step 4, and still requires `PROVISIONING_TARGETS` to exist as a concept there first.
   - Added `MONDAY_GROUP_ID=` and `MONDAY_COLUMN_MAP_JSON=` (both blank) to `.env.example`'s existing "not active" block, so the full four-var shape is now visible there — still inert, no code reads them yet outside this module.

2. **`monday-api-client.ts`** — thin GraphQL HTTP client, mockable `fetch`.
   - Sends the exact headers TASK-0023D specifies (`Authorization`, `Content-Type`, `API-Version` default `2026-04`, `Idempotency-Key`).
   - Inspects `body.errors` even on HTTP 200; classifies retryable vs non-retryable per TASK-0023D's table.
   - Test: mock `fetch` responses for each row in TASK-0023D's retryable/non-retryable table — one test per row, not one combined test.

3. **`monday-executor.ts`** — `MondayProvisioningExecutor implements ProvisioningExecutor`.
   - Builds the DB idempotency key and the separate Monday mutation idempotency key per TASK-0023D's two-key rule (this is the easiest thing to get wrong — write the test that asserts they're never the same string first).
   - Maps intake fields to Monday columns via `MONDAY_COLUMN_MAP_JSON`.
   - Stores `externalId`/`externalUrl` from `create_item` response.
   - Test: reuse the existing `MockMondayExecutor` test fixtures' shape (`ProvisioningTargetResult` assertions) so this executor is a drop-in replacement in any test that swaps executors.

4. **Runtime wiring in `runtime.module.ts`** — the part TASK-0023D doesn't fully specify.
   - Replace the dead `LIVE_PROVISIONING_ENABLED` check (currently unread) with: register `MondayProvisioningExecutor` when `PROVISIONING_TARGETS` includes `"monday"` AND `monday-config.ts` validation passes at startup; otherwise fall back to `MockMondayExecutor` with a log line saying why (matches the existing `logger.log(...)` pattern at line 66).
   - Remove `LIVE_PROVISIONING_ENABLED` from `.env.example` (dead) or wire it in — pick one; don't leave both.
   - Test: startup with `PROVISIONING_TARGETS=monday` + valid config → real executor registered; missing config → fatal startup error, not a silent mock fallback (TASK-0023D acceptance criterion 2).

5. **`scripts/validate-monday-config.ts`** — standalone smoke script (TASK-0023D's `PROVISIONING_VALIDATE_MONDAY` path: board/group/column existence, write permission).
   - No new test framework — this is a manual `npx ts-node` script, same as the file is named in TASK-0023D. A thin wrapper around `monday-api-client.ts`'s board-fetch calls.

---

## Out of scope for this task

- GitHub adapter (TASK-0023E) — separate task, same pattern, do not bundle.
- Anything in `MondayProjectType` / `distribution-rules.md` — already verified correct in TASK-0038, not touched here.

## Test plan

- Unit tests for each of steps 1–3 (config, client, executor) — table-driven for the error-classification matrix.
- Integration test at step 4: registry wiring with `PROVISIONING_TARGETS` env toggled, asserting which executor class ends up registered.
- Manual: run `scripts/validate-monday-config.ts` against a real (non-prod) board once `MONDAY_GROUP_ID`/`MONDAY_COLUMN_MAP_JSON` are confirmed.
- No code merges until the two missing env vars are confirmed (see Blockers).

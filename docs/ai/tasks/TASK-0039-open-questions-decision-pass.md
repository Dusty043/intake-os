# TASK-0039 — Open Questions Decision Pass

## Status: Complete — all code-affecting decisions implemented, including Q-FAR-3 (see Part 3 below). Built on branch `feature/scheduled-retry-backoff`, not `main`.

## Objective

Work through the backlog of open questions in `docs/ai/OPEN_QUESTIONS.md` with the user, multiple-choice style, and record the resulting decisions. Docs-only pass — no code changed in this task.

## What Changed

- `docs/ai/OPEN_QUESTIONS.md` — Q-0002 through Q-VAL-2 (21 questions) resolved or explicitly deferred, each with a decision note and date.
- `docs/product/repository-and-naming.md` — Q-REPO-001/002/003 (duplicates of Q-0002/0003/0004) updated to match.
- `docs/product/post-distribution-lifecycle.md` — Q-LIFE-001 (duplicate of central Q-LIFE-001) updated to match. Q-LIFE-002 through 005 in that file are different questions than the central Q-LIFE-002 and were left open — not part of this pass.

## Decisions Recorded

| ID | Decision |
|---|---|
| Q-0002 / Q-REPO-001 | Keep `ds`/`ops`/`client`/`internal` repo prefixes — no change |
| Q-0003 / Q-REPO-002 | GitHub org: `Simple-biz` — **tentative**, picked from guessed options, not admin-confirmed |
| Q-0004 / Q-REPO-003 | GitHub repos private by default |
| Q-0006 | Keep NestJS + Next.js monolith |
| Q-0007 / Q-0008 | Email intake (TASK-0025) deferred entirely |
| Q-0009 / Q-0010 | Google Chat integration (TASK-0026) deferred entirely; Q-0010 left open/moot |
| Q-AUTH-1 | Google Auth going live now; `GOOGLE_CLIENT_ID` to be set directly in secrets by an admin, not through chat |
| Q-AUTH-2 | Fail startup if `AUTH_SESSION_COOKIE_NAME` missing under `AUTH_MODE=google` — **not yet implemented** |
| Q-FAR-1 | Per-target `maxAttempts` (Monday vs GitHub) — **not yet implemented** |
| Q-FAR-2 | No Chat notification on dead-letter promotion (moot anyway, Chat deferred) |
| Q-FAR-3 | Backoff should be a scheduled job (v2), not synchronous — **not implemented, needs its own scoped task** (implies adding a job scheduler) |
| Q-RL-1 / Q-RL-2 | Behind nginx; nginx is primary rate-limit layer, app-level limiting is a flat backstop, no auth-tier differentiation |
| Q-COST-1 / Q-COST-2 | `gpt-5.5` live in production; cost visibility stays admin-only (already true in code) |
| Q-LIFE-001 | DevOps Lead only can mark a distributed project completed |
| Q-LIFE-002 (central) | No Chat notification on cancellation (moot, Chat deferred) |
| Q-VAL-1 | Enable `forbidNonWhitelisted: true` globally — **not yet implemented** |
| Q-VAL-2 | Description minimum length: 20 characters — **not yet implemented** |

## Not Done / Deliberately Not Implemented

Several decisions above require code changes in areas this repo's `CLAUDE.md` Safety Rules gate behind explicit human confirmation before editing:

- Q-AUTH-2 — modifies authentication startup behavior.
- Q-FAR-1, Q-FAR-3 — change retry/dead-letter behavior (Q-FAR-3 additionally implies a new job-scheduling mechanism, which is a bigger unit of work than a config tweak).

Q-VAL-1 and Q-VAL-2 aren't in the explicitly-gated categories but were left unimplemented in this pass too, since this task was scoped as decision-recording, not implementation — asked the user whether to proceed to implementation as a separate follow-up rather than assuming yes.

## Tests

Docs-only change. No code touched; no tests run.

## Follow-up / Open Items

- Confirm the real GitHub org handle before any live repo provisioning (Q-0003/Q-REPO-002) — the current value is a placeholder guess, not verified.
- Q-0010 (Google Workspace admin) stays genuinely open, tied to whether Chat integration is ever picked back up.

---

## Part 2 — Implementation (same day, user asked to proceed)

User confirmed via a follow-up multiple-choice prompt: implement all decisions requiring code now.

### Q-VAL-1 (forbidNonWhitelisted globally) — already done, no change needed

`apps/api/src/main.ts`'s `ValidationPipe` already had `forbidNonWhitelisted: true` (alongside `whitelist: true`, `transform: true`). Nothing to implement.

### Q-VAL-2 (20-char minimum intake description) — implemented

- `apps/api/src/common/validation-constants.ts` — added `MIN_INTAKE_DESCRIPTION_LENGTH = 20`.
- `apps/api/src/modules/intake/dto/create-intake.dto.ts` — `description` field: `@MinLength(1)` → `@MinLength(MIN_INTAKE_DESCRIPTION_LENGTH)`.
- `tests/input-validation.test.mjs` — `validBase.description` fixture ("A valid description", 19 chars) was below the new 20-char minimum and would have broken every test built on it; lengthened to "A valid description of sufficient length." Added `description at exact min passes` / `description under min → rejected` tests (mirrors the existing max-length pattern) and a `description max is larger than description min` sanity check.

### Q-AUTH-2 (fail startup if AUTH_SESSION_COOKIE_NAME missing under AUTH_MODE=google) — implemented

- `src/auth-config-validator.ts` — added a check alongside the existing `AUTH_GOOGLE_CLIENT_ID` one: throws if `AUTH_MODE=google` and `process.env.AUTH_SESSION_COOKIE_NAME` is unset.
- `.env.example` — noted the var is now required (startup fails without it) when `AUTH_MODE=google`.
- `tests/auth-config-validator.test.mjs` — added `AUTH_SESSION_COOKIE_NAME` save/restore in `beforeEach`/`afterEach` (previously only `AUTH_GOOGLE_CLIENT_ID` was tracked); the two existing "accepts google" tests now set it explicitly since `npm test` doesn't load `.env`, so it wasn't ambiently present; added a new negative test, `throws when AUTH_MODE=google without AUTH_SESSION_COOKIE_NAME`.

### Q-FAR-1 (per-target maxAttempts) — implemented

- `src/application/intake-workflow-service.ts` — added `AUTO_RETRY_MAX_BY_TARGET_KIND: Partial<Record<ProvisioningTargetKind, number>>`, currently empty (every target kind falls back to the existing `AUTO_RETRY_MAX = 3`). `executeWithAutoRetry()` now resolves `maxAttempts` via `executor.targetKind` instead of the hardcoded constant. This is the mechanism the decision asked for; no target kind has been given a different value yet since no one specified what those values should be — that's a config edit away, not a code change, once someone wants e.g. GitHub retried more than Monday.

### Q-FAR-3 (scheduled-job backoff, v2) — NOT implemented, deliberately

The current backoff (`src/application/provisioning/backoff.ts`'s `sleep()`, awaited inline inside `executeWithAutoRetry`) is synchronous — it blocks the calling request/worker for the backoff duration. Moving to "v2 scheduled job" means: don't block, persist a next-retry-at timestamp, and have a separate periodic sweep re-invoke the executor later. That requires:
- A new persisted field (next-retry-at) on `ProvisioningTargetResult`/the run record.
- A scheduling mechanism — no job-scheduling library is installed (checked: no `@nestjs/schedule`, no BullMQ/Redis). The lightest fit would be `@nestjs/schedule`'s in-process cron (official Nest package, no new infra), but that's still a new dependency plus a new sweep service.
- A change to `executeWithAutoRetry`'s contract: callers currently get a final result after up to `maxAttempts` attempts; under v2 they'd get an immediate "pending retry" result while attempts continue in the background — which the provisioning-run UI doesn't currently render.

This is a real feature, not a config tweak, and it touches exactly the kind of retry/dead-letter behavior this repo's `CLAUDE.md` Safety Rules call out for explicit confirmation before editing. Recorded the decision (v2 desired) but did not build it in this pass — needs its own scoped task with a design step (what runs the sweep, what the API/UI contract becomes for an in-flight retry).

### Incidental discovery and fix — rate-limiting config regression in the uncommitted working tree

Running the full suite surfaced 6 failures in `tests/rate-limiting.test.mjs` (`aiEvaluation`/`inboundWebhook` tiers the test expects were missing from `apps/api/src/config/rate-limit.config.ts`). Initially assumed pre-existing and spawned a background task for it — but `git diff` showed those two tiers exist in the last commit and were only missing from the *uncommitted* working tree, i.e. an accidental deletion sitting in-flight (likely dropped during the uncommitted TASK-0037 refactor), not a real design mismatch. Withdrew the background task and restored the two tiers (interface fields + `loadRateLimitConfig()` values) directly in `rate-limit.config.ts` — matches HEAD exactly. Confirmed neither tier is currently wired to an actual `@Throttle()` decorator anywhere (checked `intake.controller.ts` and all other controllers) — same as at HEAD, so restoring them doesn't change any runtime rate-limiting behavior, just fixes the config/test mismatch.

### Tests (Part 2)

```
npm run typecheck        — pass (root + apps/web)
npm run build:core       — pass
npm run api:build        — pass
node --test tests/*.test.mjs
  — 5 pre-existing failures remain, all confirmed unrelated to this change:
    discovery-phase-1/-3 (workflow status default 'draft' vs 'submitted' — documented
    pre-existing since TASK-0036/TASK-0037)
  — the 6 rate-limiting.test.mjs failures found mid-task are now fixed (see above)
  — auth-config-validator.test.mjs: all pass including the new AUTH_SESSION_COOKIE_NAME cases
  — input-validation.test.mjs: all pass including the new min-length cases
```

## Follow-up / Open Items (Part 2)

- `aiEvaluation`/`inboundWebhook` rate-limit tiers are restored and tested but still unwired to any endpoint (true at HEAD too, not new) — worth a follow-up if AI-evaluation and webhook endpoints are meant to have their own throttle tier rather than sharing the global one.
- If/when a target kind needs a different retry tolerance than the shared default, set it in `AUTO_RETRY_MAX_BY_TARGET_KIND` (`intake-workflow-service.ts`) — no other code changes needed.
- Q-FAR-3 (backend + frontend, full scheduled-retry design) — see Part 3 below.

---

## Part 3 — Q-FAR-3: scheduled background retry (separate branch, user asked to continue)

User asked to continue with Q-FAR-3 specifically. Before building, re-checked the actual problem being solved: the existing `AUTO_RETRY_MAX = 3` blocking backoff adds at most ~3 seconds to the caller's request (base 1s, exponential, capped 30s, only 3 attempts). Flagged that a *faithful* "don't block the caller" fix means the run has to stay `"executing"` until the background retry resolves — and the intake detail page ([apps/web/src/app/intakes/[id]/page.tsx](../../../apps/web/src/app/intakes/[id]/page.tsx)) fetches provisioning runs once on mount, no polling, so backend-only non-blocking would leave the UI stuck showing "executing" with no path to the final outcome. Asked the user to choose between full (backend + frontend polling), backend-only (accept the UI gap), or reverting the decision (not worth building for a ~3s win) — recommended full v2 if it mattered. **Chosen: full v2, on a separate branch** (not `main`, which already has 60+ uncommitted files from earlier session work). Created and switched to `feature/scheduled-retry-backoff`.

### Design chosen

No new dependency, no DB migration:
- **Scheduling mechanism**: `setTimeout`-based detached continuation (stdlib), not `@nestjs/schedule`/BullMQ (neither installed, ladder says stdlib before new dependency). Ceiling: not crash-durable — if the process restarts mid-backoff, that retry is lost. Same durability as the old blocking `await sleep()`, which was also lost on crash — no regression, just not an upgrade in that dimension either. Documented as the upgrade path if it ever bites: persisted `nextRetryAt` + a cron sweep.
- **New status only**: added `"pending_retry"` to `provisioningTargetStatuses` (`src/domain/provisioning.ts`) — no new DB column needed, since `status` is a plain Prisma `String` column, not an enum.
- **No DB schema change** — avoided entirely by not persisting retry timing; the continuation and its timer live only in the Node process's event loop.

### What changed

- `src/domain/provisioning.ts` — added `"pending_retry"` target status.
- `src/application/intake-workflow-service.ts` — replaced `executeWithAutoRetry` (blocking loop) with:
  - `attemptOnce` — single attempt + error categorization (extracted, unchanged logic).
  - `isAutoRetryableResult` — now calls the existing `isAutoRetryable()` helper from `error-categories.ts` instead of re-deriving the transient/rate_limit check inline (was duplicated logic before this change too).
  - `executeTargetsAndFinalize` — runs every executor once; a target that's auto-retryable with attempts remaining is returned as `"pending_retry"` immediately and its remaining attempts continue via `settleBackgroundRetry` (detached, not awaited). Persists the interim run, then finalizes immediately if nothing is pending (byte-for-byte same behavior as before for the common no-retry-needed case), or returns the still-`"executing"` run if something is.
  - `settleBackgroundRetry` — the detached continuation: sleeps the backoff, retries, and on final settlement re-fetches the current run, replaces its own target's result, and either finalizes (if no other target is still pending) or persists the interim state (if another target is still backing off — the multi-target-concurrently-retrying edge case).
  - `finalizeProvisioningRun` — extracted the tail logic that used to be duplicated (slightly differently) at the end of `executeDistribution` and `retryFailedProvisioningTargets`: dead-letter ceiling check, run status computation, workflow transition, audit, Chat notification. Callable from either the synchronous path or the background-settled path. Fixed a latent double-counting risk in the process: the original dead-letter `failCount` calculation assumed "this run isn't persisted yet" (`+1` fudge) — no longer safe once an interim save can happen before finalize, so it now explicitly excludes the current run's id from the `allRuns` fetch instead.
  - `executeDistribution` and `retryFailedProvisioningTargets` — both now just build their `ProvisioningContext` and call `executeTargetsAndFinalize`; all the dead-letter/transition/audit/notify code that used to live inline in both methods (with slightly different wording) is gone from here.
- `apps/web/src/lib/types.ts` — added `"pending_retry"` to the frontend's `ProvisioningTargetResult.status` union (duplicated from the backend domain type, as it already was for the other statuses).
- `apps/web/src/app/intakes/[id]/page.tsx` — `RunStatusBadge` gets a `"Retrying…"` (warning-styled) label for `pending_retry`; added a polling `useEffect` keyed on whether any loaded run is `"executing"` — polls `listProvisioningRuns` + the intake record every 2s until settled, then stops (dependency array uses the derived boolean, not the `runs` array, so it doesn't restart the interval on every tick).

### Tests

- `tests/provisioning-scheduled-retry.test.mjs` (new) — a custom `ProvisioningExecutor` that fails with a transient-category message (`"503 Service Unavailable"`) for N calls then succeeds, used to prove:
  1. `executeDistribution` returns immediately (`< 500ms`) with `run.status === "executing"` and the target `"pending_retry"` — proves it isn't blocking on backoff.
  2. Waiting for the background retry to settle (polling `listProvisioningRuns`) shows the run finalize to `"completed"`, the target `"succeeded"` with `attemptCount: 2`, and the intake transitions to `"distributed"`.
  3. An executor that never succeeds exhausts all 3 attempts in the background, finalizes the run to `"failed"`, and transitions the intake to `"provisioning_failed"`.
- `tests/provisioning-execution.test.mjs` + `tests/provisioning-retry.test.mjs` (existing, unmodified) — all 20 tests still pass; confirmed the existing mock executors (`createMockRegistry`) never produce an auto-retryable error category (their failure messages don't match any transient/rate-limit keyword in `error-categories.ts`), so they never exercised this path before or after — this refactor's "no behavior change for the common case" claim is backed by these passing unmodified.
- Full suite: `node --test tests/*.test.mjs` — same 5 pre-existing discovery failures as before this task, nothing new.
- `npm run typecheck` (root + apps/web) — pass.
- `npm run build:core`, `npm run api:build` — pass.
- `cd apps/web && npm run build` — production build succeeds, all 13 routes compile.

### Follow-up / Open Items (Part 3)

- This branch (`feature/scheduled-retry-backoff`) has not been merged to `main` — it also carries all of `main`'s prior uncommitted changes (TASK-0037/38/39 Parts 1–2), since nothing was committed before branching. Needs a decision on commit/merge strategy before landing.
- If crash-durability of in-flight background retries ever matters in practice (process restarts frequently, or backoff windows get much longer), upgrade path is a persisted `nextRetryAt` + a sweep — deliberately not built now since the current gap is no worse than the blocking version it replaced.
- Multi-target concurrent backgrounding (two targets both needing backoff at once) is handled (`settleBackgroundRetry` checks whether *other* targets are still pending before finalizing) but only exercised implicitly — no test constructs that specific race on purpose.

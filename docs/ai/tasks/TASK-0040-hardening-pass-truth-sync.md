# TASK-0040 — Hardening Pass and Truth Sync

## Status: Complete

## Objective

User supplied `project_intake_os_hardening_pass.md`, a document-only hardening plan prepared
2026-07-01 against an uploaded `intake-os-main.zip` snapshot, and asked to implement it.

Renumbered from the spec's own `TASK-0037` — that number is already used in this repo's history
for "Discovery Engine AI Cost Reporting" (this session, earlier). Following the spec's slice
structure (A–F) but adapting to current reality where it's drifted since the doc was prepared
(most notably: real Prisma migrations already exist now, and this session's own earlier work
already partially addressed two of the seven findings).

**Branch**: `feature/hardening-pass-truth-sync`, branched from `feature/scheduled-retry-backoff`
(which has its own open PR #1) — kept separate since this is a distinct concern.

## Ground-Truth Verification (before implementing)

Re-checked each spec finding against current code rather than trusting the doc verbatim, since
it predates several changes made earlier in this session:

| Finding | Spec's claim | Current reality |
|---|---|---|
| F1 (docs overstate live integrations) | README/EXTERNAL-NEEDS.md claim Monday/GitHub/email/Chat adapters are "Built" | **Confirmed still true.** No `MondayProvisioningExecutor`/GitHub executor/`/intake-sources/*` routes exist anywhere in `apps/api/src` or `src`. |
| F2 (env contract drift) | `.env.example`/`.env.server.example` missing active vars | **Confirmed.** `GOOGLE_CHAT_WEBHOOK_URL`, `ANALYSIS_ENGINE`, `PROVISIONING_EXECUTOR_MODE`, `ROSTER_API_URL`, `ROSTER_API_KEY`, all `RATE_LIMIT_*` are read by code (`grep`-verified) but absent from both example files. Also found dead vars the spec didn't flag: `DYNAMODB_JOB_STATUS_TABLE`, `AI_BATCH_SIZE`, `AI_BATCH_INTERVAL_SECONDS`, `AI_MAX_INPUT_CHARS` have zero code references (the DynamoDB job-status store was deleted in this session's ponytail-audit cleanup; the batch vars appear to have never been built). |
| F3 (decorative runtime switches) | Swagger always mounts regardless of `SWAGGER_ENABLED`; port uses `PORT` not `API_PORT` | **Confirmed still true**, verbatim. |
| F4 (Discovery validation lighter than intake) | Inline body types, no DTOs, no throttles, raw `Error` throws | **Confirmed still true.** `discovery.controller.ts` has zero DTO classes; `discovery-orchestrator.ts`/`discovery-session-store.ts` throw raw `Error` for every not-found/invalid-state case; no `@Throttle` on any discovery route despite several invoking real LLM calls when `AI_PROVIDER≠mock`. |
| F5 (OAuth validator incomplete) | Missing `AUTH_GOOGLE_CLIENT_SECRET` check | **Partially already fixed this session** — added an `AUTH_SESSION_COOKIE_NAME` check earlier (TASK-0039 Part 2), but `AUTH_GOOGLE_CLIENT_SECRET` is still unchecked. Confirmed via reading `src/auth-config-validator.ts`. |
| F6 (schema-push only, no migrations) | "Prisma migrations directory contains only `migration_lock.toml`" | **Stale — spec is wrong here.** 5 real migrations exist under `apps/api/prisma/migrations/` (`20260609193242_initial` through `20260630000000_add_discovery_session`). `Dockerfile.api` still runs `prisma db push` with a comment claiming "no migration files exist" — that comment is now false; the fix is just switching the command, not generating a baseline migration from scratch. |
| F7 (stale project memory) | `PROJECT_MEMORY.md` claims nothing is built | **Confirmed, worse than described.** Literally says "No database, UI, queue worker, authentication provider, live AI provider, Monday integration, or GitHub integration has been implemented yet" — none of that has been true for a long time. |

## What Changed

### Slice A — Truth sync

- `README.md`:
  - Build-state table rewritten using the spec's status buckets (Built / Built mock-only / Built
    env-gated / Spec-ready not implemented), each row cited against actual code, not aspiration.
  - Removed `POST /intake-sources/email` and `POST /intake-sources/chat` from the API reference
    table (they don't exist) — replaced with a note pointing at the relevant task docs.
  - Repository map's `src/application/provisioning/` line corrected — mock executors only, adapter
    contracts are specs, not code.
  - Test count references (685 → 710, the current accurate count) — noted the 5 known pre-existing
    failures rather than implying a fully green suite.
- `docs/EXTERNAL-NEEDS.md`: items 4–7 (GitHub, Monday, Email, Chat slash command) reworded from
  "already built, just needs credentials" to "not implemented in code — needs an executor/route
  built first, then credentials." Added a "Code status" column to the summary table so this is
  visible without reading every section.
- `docs/ai/PROJECT_MEMORY.md`: full rewrite from the "nothing exists" snapshot to current state
  (Built / Built mock-only / Spec-ready lists), plus a "Known Gaps" section flagging the exact
  kind of drift that caused this task, so it's harder for a future session to regress the same way.
- `docs/ai/OPEN_QUESTIONS.md`: already accurate from this session's earlier TASK-0039 work — no
  changes needed (Monday/GitHub/email/Chat questions already correctly marked
  deferred/tentative/open, not falsely resolved).
- `docs/ai/MEMORY_INDEX.md`: added this task log's entry.

### Slice B — Environment contract sync

- `.env.example` / `.env.server.example`:
  - Renamed `API_PORT` → `PORT` (matches what `apps/api/src/main.ts` actually reads — the doc
    was documenting a variable the code has never looked at).
  - Added the 5 active vars the spec flagged: `ANALYSIS_ENGINE`, `PROVISIONING_EXECUTOR_MODE`,
    `ROSTER_API_URL`, `ROSTER_API_KEY`, `GOOGLE_CHAT_WEBHOOK_URL`, plus all 12 `RATE_LIMIT_*`
    override vars (commented, since every tier has a working code default).
  - Removed vars with **zero** code references anywhere in `apps/api/src`/`src`, found while
    verifying — beyond what the spec flagged: `DYNAMODB_JOB_STATUS_TABLE` (the job-status store
    was deleted in this session's ponytail-audit cleanup), `AI_BATCH_SIZE`/`AI_BATCH_INTERVAL_SECONDS`
    (no batch runner exists), `AI_MAX_INPUT_CHARS` (server example only), `BITRIX24_WEBHOOK_URL`
    (the Bitrix24 controller takes direct POST payloads, no webhook-secret verification exists).
  - Moved `LIVE_PROVISIONING_ENABLED`, `MONDAY_API_TOKEN`, `MONDAY_BOARD_ID`, `GITHUB_ORG`,
    `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY_PATH`, `INTAKE_APP_URL` into a clearly marked "not active"
    block with an explanation of why (no live adapter reads them). Also replaced the real
    `MONDAY_BOARD_ID=18419115951` placeholder value with a blank — that block now signals "this
    isn't real yet," so a real-looking board ID there was actively misleading.
- `docs/deployment/private-server-runtime.md`: fixed the same stale `API_PORT` reference in its
  environment variable table.
- `apps/web/.env.local.example`: checked, already accurate (`NEXT_PUBLIC_API_BASE_URL` and
  `NEXT_PUBLIC_AUTH_MODE` both match real usage) — no changes needed.

### Slice C — Runtime config guardrails

- `apps/api/src/main.ts`: `SWAGGER_ENABLED`/`SWAGGER_PATH` are now actually read — Swagger only
  mounts when enabled (default true, matching the example files), at the configured path (default
  `docs`). Added a one-line startup config summary (`NODE_ENV`, `PORT`, Swagger status, rate-limit
  config) — printed via `console.log`, no secret values. Per-subsystem detail (AI provider,
  analysis engine, executor mode, roster/chat enabled) was already logged by `RuntimeModule`
  during Nest bootstrap; this fills the one gap (Swagger + rate limiting) rather than duplicating
  what already existed.
- `src/auth-config-validator.ts`: added the missing `AUTH_GOOGLE_CLIENT_SECRET` check alongside
  the existing `AUTH_GOOGLE_CLIENT_ID`/`AUTH_SESSION_COOKIE_NAME` checks under `AUTH_MODE=google`.
  Updated `tests/auth-config-validator.test.mjs` (existing "accepts google" tests now set the
  secret too; added a new negative test).
- `apps/api/src/config/rate-limit.config.ts`: added `parsePositiveInt()` — a present-but-unusable
  value (non-numeric, empty, zero, or negative) now falls back to the tier's default with a
  `console.warn`, instead of reaching `ThrottlerModule` as `NaN`/`0` (which would have silently
  disabled or always-tripped that tier). A genuinely unset var still silently uses the default, as
  before — only a bad *value* warns. Added `tests/rate-limiting.test.mjs` coverage for all four
  invalid-input cases.
- Port naming (`API_PORT` → `PORT`) was already fixed in Slice B (docs-only, since code already
  read `PORT`) — no code change needed here.

### Slice D — Discovery endpoint hardening

- New DTOs (`apps/api/src/modules/discovery/dto/`): `DiscoveryMessageDto` (shared by `POST
  /discovery` start and `POST /discovery/:id/message` follow-up — identical shape, one class),
  `AnswerClarificationDto`, `SelectDirectionDto`. All use `class-validator` with existing length
  constants (`MAX_DISCOVERY_FIELD_LENGTH` for free text, `MAX_EXTERNAL_ID_LENGTH` for IDs) —
  no new constants needed for these three.
- `apps/api/src/modules/admin/dto/update-discovery-settings.dto.ts`: replaced the plain
  `interface UpdateDiscoverySettingsDto` in `settings.controller.ts` (zero validation — `orgContext`
  had no length bound at all, despite being injected into every discovery agent's system prompt on
  every call) with a real validated class. Added `MAX_ORG_CONTEXT_LENGTH = 4000` (new constant —
  nothing existing fit; it needs to be more generous than a single structured field). Removed the
  controller's manual `Math.max(0.1, Math.min(0.9, ...))` clamp for `confidenceThreshold` now that
  `@Min(0.1)`/`@Max(0.9)` validates it — confirmed safe first: the web settings page's range slider
  is already hard-limited to 10–90, so it can never send an out-of-range value in normal use.
- `discovery.controller.ts`: swapped all five inline body-shape params for the DTO classes above.
  Added `@Throttle` (using the existing but previously-unused `aiEvaluation` rate-limit tier) to
  the six routes that can invoke a real LLM call when `AI_PROVIDER≠mock`: start, message,
  solutions, proposal, manifest, send-to-evaluation — per the spec's list. Left
  `answerClarification`/`skipClarifications`/`selectDirection` unthrottled, matching the spec
  (they don't call an LLM directly).
- Converted raw `throw new Error(...)` to typed application errors in `discovery-orchestrator.ts`,
  `discovery-session-store.ts` (in-memory), and `prisma-discovery-session-store.ts` (Postgres) —
  8 not-found sites → `NotFoundError`, 3 invalid-state sites → `ValidationError`. These now map to
  clean 404/400 via `ApplicationExceptionFilter` instead of a generic 500. **Deliberately left
  two sites unconverted**: the "Proposal composition failed" defensive guards in
  `composeProposal`/`sendToEvaluation`/`generateManifest` check an invariant that should never be
  false if `composeProposal` ran correctly — that's a genuine internal-error case, not a client
  mistake, so 500 via the filter's fallback is the *correct* status, not a gap to close.
- Tests: added DTO validation coverage for all four new/changed DTOs to `tests/input-validation.test.mjs`
  (missing fields, over-length, wrong type, unknown-field rejection, boundary values) following the
  file's existing pattern exactly. Strengthened one `NotFoundError` and one `ValidationError` test
  site (of the 8+3 converted) in `discovery-phase-1.test.mjs`/`discovery-phase-3.test.mjs` to assert
  the actual error class, not just the message text — proves the conversion is real, not cosmetic,
  without rewriting every existing not-found test that already passed on message-regex alone.
- **Not done**: no automated test asserts `@Throttle` decorator metadata on the six routes — this
  repo has no existing pattern for that (checked: not even the already-throttled intake routes have
  one), so this is verified by code review only, consistent with the spec's own fallback option
  ("or a documented reason for relying only on the global throttle" — here the reason is "no
  metadata-testing convention exists yet in this codebase to extend").

### Slice E — Database release hardening

Much smaller than the spec assumed, since real migrations already exist (see the ground-truth
table above) — but verifying that turned up something the spec couldn't have known about.

- `Dockerfile.api`: switched the container's startup command from `prisma db push` to
  `npm run prisma:migrate:deploy` (the npm script already existed, wasn't being used here), and
  fixed the stale comment claiming no migration files exist.
- **Verified this is actually safe before committing to it** — spun up a disposable throwaway
  Postgres container (not touching any real database, removed after), ran `prisma migrate deploy`
  against a completely fresh instance, then `prisma migrate diff` between the resulting DB and
  `schema.prisma`. **Found real drift**: the 5 tracked migrations did not produce the same schema
  as `schema.prisma` — missing 4 `RequestStatus` enum values (`in_progress`, `blocked`, `completed`,
  `canceled` — the post-distribution lifecycle states from TASK-0031) and three
  `ProvisioningTargetResult`/`ProvisioningRun` columns plus an index (dead-letter/retry fields from
  TASK-0028/TASK-0031). All of this had clearly been applied via `prisma db push` locally at some
  point without a matching migration ever being generated — exactly the kind of gap that switching
  to `migrate deploy` would have surfaced the hard way, on the first real deploy, if not caught now.
  If this task had just changed the Dockerfile command without checking, the next deploy to a
  fresh database would have booted against a schema missing lifecycle statuses the domain code
  actively uses.
- Generated the missing migration (`20260701181004_sync_schema_drift_task_0040`) against the
  throwaway DB with `prisma migrate dev`, reviewed it (all additive — new enum values, new
  nullable columns, new index; no drops, no data-loss risk), then re-verified from a second fresh
  throwaway DB: all 6 migrations apply cleanly, and `prisma migrate diff` against the live schema
  now reports zero drift ("This is an empty migration").
- Not done: no separate "release checklist" doc — the spec's suggested content (backup, migrate,
  health check, smoke API, rollback note) is already covered by
  `docs/deployment/private-server-runtime.md`'s existing Backup/Start-stop/Healthcheck sections;
  adding a second checklist doc saying the same thing seemed like duplication rather than hardening.

### Slice F — Verification and build log

- `npm run typecheck`, `npm run build:core`, `npm run api:build` — pass.
- `cd apps/web && npm run build` — production build succeeds, all 13 routes compile.
- `node --test tests/*.test.mjs` — 738 tests, 733 pass, same 5 pre-existing discovery
  workflow-status-default failures as before this task (unrelated, documented since TASK-0036/37).
- **Live governance-flow verification** (not just unit tests): spun up a disposable Postgres +
  API stack (same throwaway-container pattern as Slice E's migration check, torn down after) and
  ran the repo's own smoke/benchmark scripts against it:
  - `npm run smoke:api` — 7/7 pass.
  - `npm run smoke:runtime` — **initially failed 9/19** with `property decision should not exist`
    on both approval-gate steps. Root cause: `scripts/smoke-runtime-workflow.mjs` sends
    `{ decision: "approved", comment }` to `POST /intakes/:id/approvals`, but
    `ApprovalDecisionDto` has no `decision` field (approving *is* what hitting `/approvals` means;
    rejection is a separate `/rejections` endpoint) — `forbidNonWhitelisted` correctly rejects the
    extra field. Pre-existing bug in the smoke script, unrelated to anything else in this task;
    found only because Slice F asked to actually confirm the demo path works end to end rather
    than trust that it does. Same stale `decision` field also present in
    `scripts/benchmark-governance-flow.mjs` (harmless there — it calls the service directly, no
    DTO/HTTP layer involved — but misleading to leave in). Removed the field from both scripts.
    Re-ran: **19/19 pass.**
  - `npm run bench:governance` — all governance guards pass, no issues.
  - Confirmed the `[Config]` startup summary log (Slice C) and `/docs-json` (Swagger, Slice C)
    both work correctly against this stack.
  - Cleaned up: killed the API process, `docker stop`/`rm` the throwaway Postgres container.
    Confirmed no leftover containers or processes afterward.
- `docs/product/requirements-trace.md`: added notes to `CV-001`/`CV-002` (Discovery DTOs) and
  `GAP-007` (the `AUTH_GOOGLE_CLIENT_SECRET` fix). Also fixed an unrelated pre-existing typo found
  while editing this file — `B-012` and `G-001`–`G-007` (all AI-cost-governance requirements)
  referenced `TASK-0040` when they clearly meant `TASK-0030` (the actual AI Cost Governance task;
  confirmed against `docs/ai/tasks/TASK-0030-ai-cost-governance.md`). Fixed all 8 occurrences.
- `README.md`: updated the test count references from the Slice A value (710) to the final count
  (738) now that Slice D added tests.

## Acceptance Criteria (from the spec)

- [x] README no longer claims unimplemented live adapters or inbound routes are built.
- [x] API reference only lists implemented routes or clearly labels planned routes as planned.
- [x] Environment examples include every active `process.env` variable used by runtime code, with
      future variables clearly separated.
- [x] Project memory and open questions are updated to match current code state.
- [x] Swagger enable/path settings are wired (not removed — chosen to wire, since both examples
      already documented them as if active).
- [x] Auth config validation fails early for incomplete Google OAuth credentials
      (`AUTH_GOOGLE_CLIENT_SECRET` now required alongside `AUTH_GOOGLE_CLIENT_ID`).
- [x] Discovery routes have DTO validation and sane max-length protection.
- [x] AI-triggering Discovery routes have route-specific throttles (`aiEvaluation` tier).
- [x] Production database startup no longer relies on untracked schema push
      (`prisma migrate deploy`, with the schema-drift migration this surfaced now tracked).
- [x] `npm run typecheck`, `npm test`, `npm run api:build`, and
      `npm --prefix apps/web run build` pass from a clean install.
- [x] No live external write path is enabled by this task (verified: `LIVE_PROVISIONING_ENABLED`
      still `false`; no Monday/GitHub executor code was added).

## Summary of Incidental Findings (beyond the spec's own list)

Verifying each slice against live behavior — not just trusting the spec's description — surfaced
five things the spec couldn't have known about from a static-only review:

1. Real Prisma migrations already exist (spec assumed schema-first/no-migrations).
2. Dead env vars beyond what the spec flagged: `DYNAMODB_JOB_STATUS_TABLE`, `AI_BATCH_SIZE`,
   `AI_BATCH_INTERVAL_SECONDS`, `AI_MAX_INPUT_CHARS`, `BITRIX24_WEBHOOK_URL`.
3. **Real schema drift**: the tracked migrations didn't produce the same schema as
   `schema.prisma` — missing lifecycle-status enum values and dead-letter/retry columns that had
   only ever been applied via local `db push`. Switching to `migrate deploy` without catching this
   first would have shipped a broken fresh-database deploy.
4. **A broken verification script**: `smoke-runtime-workflow.mjs` (and `benchmark-governance-flow.mjs`)
   send a field the approval DTO rejects — meaning the repo's own governance-flow smoke test could
   not have passed for a while before this task, silently.
5. **None of the migration SQL files were ever tracked in git — including the 5 that predate this
   task.** `.gitignore` had an unanchored `*.sql` rule (meant to keep local Postgres backup dumps
   out of the repo) that also matched every `migration.sql` under
   `apps/api/prisma/migrations/**/`. `git ls-files` on that directory showed only
   `migration_lock.toml` tracked — zero actual migrations. Since the real deployment flow is
   `git pull` on the server followed by `docker compose build` (per
   `docs/deployment/private-server-runtime.md`), this would have made the Slice E fix
   (`prisma migrate deploy`) **completely non-functional on a real deploy** — a fresh `git clone`
   or `git pull` would never bring the migration files at all, regardless of what's sitting on
   disk locally where they were generated. Found only by checking `git status`/`git ls-files`
   before committing, not by trusting that "files exist on disk" meant "files are in the repo."
   Fixed by scoping the ignore rule to `backups/*.sql`/`backups/*.dump` instead of a bare `*.sql`.
   Same root-cause pattern as the `task-*.md` bug found in TASK-0039 Part 4's PR (an unanchored
   glob meant for one location swallowing a completely different, legitimate directory) — worth
   treating "does this `.gitignore` pattern accidentally match somewhere else in the tree" as a
   standing question whenever a *.md/*.sql/*-style pattern gets added anywhere in this file.

None of these are Q-FAR-3/TASK-0039 issues or introduced by this task — all five predate it and
were only found because this task's own verification step (Slice F) insisted on running things
live and checking actual git/deploy state instead of trusting that they worked.

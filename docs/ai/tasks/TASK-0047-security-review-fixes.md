# TASK-0047: Full Review Pass — GitHub Issues + Subagent Fixes

**Status:** Complete (pending PR / migration follow-up — see below)
**Date:** 2026-07-07
**Branch:** `fix/review-findings-batch-1`

## Context

User requested a "full review pass" (correctness, security, performance) across the whole
repo, on top of an earlier `ponytail-audit` pass (over-engineering only, no findings of
consequence beyond an unused `packages/shared` scaffold and an unused `class-transformer`
dependency — not tracked as GitHub issues, left as a follow-up note).

Ran 5 parallel specialized review agents (API security, core-lib security, TypeScript
correctness, frontend, performance) across `apps/api`, `apps/web`, and `src/`. Findings
consolidated, then the user asked to open a GitHub issue per problem and fix via subagents.

## What was done

1. **Filed GitHub issues #6–#27** (22 total) on `Dusty043/intake-os`, one per finding,
   labeled `security` / `correctness` / `performance` / `accessibility` (new labels created).
   Used the `Dusty043` account's token (has push/admin) rather than the session's active
   `pxm-0` account (read-only on this repo) — no global `gh` auth state was changed.

2. **Branch `fix/review-findings-batch-1`** created from `main` (carries forward pre-existing
   unrelated WIP — `monday-config.ts` / TASK-0045 — untouched, not committed by this task).

3. **10 parallel subagents fixed the 22 issues**, each scoped to non-overlapping files
   except `src/application/intake-workflow-service.ts` (6 issues, one agent) — see
   `docs/ai/BUILD_LOG.md` entry for the full file-by-file breakdown.

4. **Verification** (full, not agent-self-reported): `npx tsc --noEmit` on all three
   tsconfigs (core, `apps/api`, `apps/web`) — clean. `npm run build:core && node --test
   tests/*.test.mjs` — **23 pre-existing tests failed** as a direct, correct consequence of
   the new permission/visibility checks (tests called `getIntake`/`getAuditTrail` without an
   actor, or asserted the old insecure/buggy behavior). Fixed by:
   - Adding the now-required `actor` argument to ~20 test call sites across 10 test files
     (used `devopsLead`/`intakeOwner` fixtures — non-`"own"`-visibility roles, so they see
     everything, matching the tests' original intent of inspecting state, not testing
     permission boundaries).
   - Rewriting `tests/provisioning-failure-recovery.test.mjs`'s "silently succeeds when
     target not found" test to assert `NotFoundError` instead (issue #17's fix intentionally
     changed this from a silent no-op to a thrown error).

5. **Found and fixed a real bug introduced by the issue #6/#7 fix**, caught by the test run
   above, not by review: the fix agent gated `executeDistribution` /
   `retryFailedProvisioningTargets` with `canTriggerProvisioning`/`canRetryProvisioning`
   (`src/domain/permissions.ts`), which bundle the role check together with request-state
   checks. That made a fully-authorized `devops_lead` calling these methods on an intake
   that simply isn't in the right state yet (e.g. missing Gate 1 approval) get a misleading
   `PermissionDeniedError` instead of the correct, specific `ValidationError`. Per
   `CLAUDE.md`'s "ask before modifying authentication or authorization" rule, confirmed with
   the user before fixing. Fix: replaced with `ensurePermission(actor, action)` — this
   file's own established pure-role-check convention, already used ~10 other places
   including the directly analogous `generateProvisioningPlan` — in `executeDistribution`,
   `retryFailedProvisioningTargets`, **and** `markReadyForProvisioning` (same latent bug,
   pre-existing, not introduced by today's changes, but same fix class — user opted to fix
   all three for consistency). Removed the now-unused `canTriggerProvisioning`/
   `canRetryProvisioning` imports.

6. Final full re-run: `npm run check` (typecheck + `node --test tests/*.test.mjs`) —
   **769/769 passing**, 0 failures.

## Files changed

See `git diff --stat` on `fix/review-findings-batch-1` vs `main`. Summary by area:

- **Auth/permissions**: `src/application/intake-workflow-service.ts`,
  `apps/api/src/modules/bitrix24/bitrix24.controller.ts` (+ new
  `dto/bitrix24-intake-payload.dto.ts`), `apps/api/src/modules/discovery/discovery.controller.ts`,
  `apps/api/src/modules/intake/intake.controller.ts`, `src/application/intake-controller.ts`,
  `src/application/types.ts`, `src/application/in-memory-store.ts`,
  `apps/api/src/persistence/prisma-project-intake-store.ts`.
- **Race conditions**: `apps/api/src/persistence/prisma-discovery-session-store.ts`
  (optimistic concurrency via `updatedAt` compare-and-swap, no migration needed),
  `src/application/discovery/discovery-session-store.ts` (clone-on-read/write).
- **Frontend**: `apps/web/src/app/intakes/[id]/page.tsx`,
  `apps/web/src/components/discovery/DiscoveryChat.tsx`.
- **Notifications**: `src/application/notifications/google-chat-notifier.ts` (markup
  sanitization).
- **Performance**: `apps/api/src/persistence/prisma-project-intake-store.ts` (batched
  writes, pagination, `Promise.all`), `apps/api/prisma/schema.prisma` (3 new `@@index`
  additions — **migration not generated**, see follow-up), `src/application/discovery/discovery-orchestrator.ts`.
- **Dependency**: `package.json`/`package-lock.json` — `multer` pinned to `2.2.0` via
  `overrides` (fixes 2 DoS advisories; no actual upload endpoint exists in this codebase,
  so real-world exposure was nil, but hygiene fix applied since a safe non-breaking version
  existed).
- **Tests**: ~20 call-site updates across 10 files + 1 behavior-assertion rewrite (see above).

## Tests / checks run

- `npx tsc --noEmit -p tsconfig.json` — clean
- `npx tsc --noEmit -p apps/api/tsconfig.json` — clean
- `npx tsc --noEmit` (apps/web) — clean
- `npm run check` (build:core + full test suite) — **769/769 passing**

## Not done / follow-ups

- **No PR opened yet** — pending user decision on PR granularity (one PR vs. split by
  theme).
- **Prisma migration not generated** for the 3 new `@@index([createdAt])` additions
  (`ProjectIntake`, `AgentRun`) — no live dev DB in this session. Someone with DB access
  needs to run `npm run prisma:migrate` before this ships.
- **TOCTOU race on provisioning-run creation (issue #13)** — fully closed for the in-memory
  store; mitigated (narrowed, not eliminated) for the Prisma store via a `$transaction`
  wrapping `findFirst` + `create`, which doesn't fully close the window under READ
  COMMITTED. A follow-up `CREATE UNIQUE INDEX ... WHERE status = 'executing'` migration is
  the real fix — documented inline as a comment at the call site.
- **Audit visibility (issue #11)** — only the `"own"` tier (`request_creator`) is enforced.
  `"assigned"` (`intake_owner`) and `"operational"` (`devops_lead`) tiers remain
  unrestricted (matches prior/legacy behavior) because `ProjectIntakeRecord` has no
  per-request assignee field to filter on — flagged as a new open question below.
- **Discovery session cross-user access (issue #10)** — reused the existing `"full"`
  audit-visibility tier (admin only) as the "can view any session" signal since no dedicated
  discovery permission exists yet.
- `ponytail-audit` findings (unused `packages/shared` scaffold, unused `class-transformer`
  dependency, `AnalysisProviderRouter` delegate-only wrapper class) were **not** fixed in
  this task — out of scope (over-engineering cleanup, not correctness/security/performance).

## Handoff

**What changed**: 22 real bugs (3 critical auth gaps, 8 high, 6 medium, 5 perf) fixed across
21 files, plus one bug found during verification (misleading permission errors) fixed with
explicit user confirmation, plus ~21 test files updated to match the corrected behavior.

**Why**: user-requested full review pass surfaced real security/correctness/performance
issues; user then asked for GitHub issue tracking + subagent-driven fixes.

**How tested**: full typecheck (3 tsconfigs) + full test suite (769/769), not just
per-agent self-reported checks — this caught a real bug the agents' individual verification
missed (see item 5 above).

**Intentionally not changed**: `packages/shared`/`class-transformer` cleanup (ponytail-audit
scope, different task); the two unenforced audit-visibility tiers (needs a product decision
on what "assigned"/"operational" should filter on, since no assignee field exists today).

**Needs review**: the Bitrix24 auth fix's trust model (service-token-based, role comes from
the `AUTH_SERVICE_TOKENS` entry an operator issues — flagged by the fix agent as a config
decision, not hardcoded); whether `intake-preview` (still `@Public()`, read-only) should
also be locked down.

**Open questions**: see `docs/ai/OPEN_QUESTIONS.md` (Q-SEC-1, Q-SEC-2 added).

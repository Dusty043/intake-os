# TASK-0043 — Fix Stale Discovery Test Assertions

**Date:** 2026-07-02
**Status:** implemented

## Context

5 tests had been failing since before this session, always described as "known
pre-existing failures in discovery workflow-status defaults" (`README.md`).
Asked for a proper state report, traced each failure to its actual assertion
and root cause instead of repeating that label.

## Root Causes (both are stale tests, not application bugs)

1. **3 tests in `tests/discovery-phase-1.test.mjs`** (lines 207, 265, 356)
   asserted message counts of 1 and 2. `DiscoveryOrchestrator.runAnalysis`
   (`src/application/discovery/discovery-orchestrator.ts:509-522`) appends an
   `"ai"`-role reply to session history after every turn — a real, deliberate
   feature (the conversational reply has to be stored somewhere to be shown).
   These three tests were written before that existed and only counted user
   messages.

2. **2 tests in `tests/discovery-phase-3.test.mjs`** (lines 226, 433) asserted
   `record.status === "draft"`. Traced via `git log -p` on
   `proposal-to-intake-adapter.ts` to commit `1325c3e` ("fix: auto-submit and
   auto-evaluate intake when sending discovery to evaluation") — a deliberate,
   already-committed change that intentionally sets `status: "submitted"`
   instead of `"draft"` for discovery-composed intakes, since discovery
   already did the drafting work through conversation. These two tests
   predate that commit.

## Fix

Updated the 5 assertions to match current, intentional behavior:
- Message-count checks: `1→2`, `2→4`, `2→4`.
- Status checks: `"draft"→"submitted"` in both.

Added a one-line comment at each site explaining *why* the expected value is
what it is (referencing the commit for the status ones), so this doesn't
silently drift again.

No application code changed — this was test-only.

## Testing

- `npm run typecheck` — clean.
- `npm test` — **752/752 passing, 0 failures** (up from 747/752 — the
  previous 5 failures are now fixed, no new ones introduced).

## Docs Updated

- `README.md` — removed the two "5 known pre-existing failures" callouts
  (test count line, repository map line); both now just say "752 tests, all
  passing".

## Not Changed

- No product/application behavior — confirmed via `git log -p` that both
  underlying behaviors (assistant reply appended to history; discovery
  intakes auto-submit) were prior deliberate decisions, not something to
  revisit here.

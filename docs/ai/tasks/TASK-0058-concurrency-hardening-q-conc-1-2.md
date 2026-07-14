# TASK-0058 — Concurrency hardening: Q-CONC-1 (intake CAS) + Q-CONC-2 (dupe intake guard)

## Request

User: "answer q-conc-1 and 2 yes to both but you can override prioritising
making the flow work." Both were logged as open, not-yet-implemented
follow-ups in TASK-0057 (the discovery→intake draft-ready race fix), each
flagged there as a bigger, separately-reviewable change to idempotency/retry
behavior per CLAUDE.md's Safety Rules. User authorization received in this
session; proceeded with an intentionally scoped implementation rather than
an exhaustive one, per the "prioritize making the flow work" instruction.

## Context Read

- `docs/product/failure-and-recovery.md` — confirmed "retry only when the
  action is idempotent or can be made idempotent" as the existing governing
  principle; nothing there conflicts with a compare-and-swap approach.
- `docs/product/workflow-state-machine.md` — re-confirmed transition table
  (`generate_evaluation` only from `submitted`, etc.) since the CAS retry
  logic in `applyTransitionToRecord` needed to reason about valid `to`
  states per action.
- `apps/api/src/persistence/prisma-discovery-session-store.ts` — the
  existing CAS pattern in this codebase (`updatedAt`-based `updateMany`
  WHERE clause, bounded retry, `ConflictError` on exhaustion). Mirrored
  this pattern rather than inventing a new one.
- `tests/api/prisma-discovery-session-store.test.mjs` — the existing
  fake-Prisma (`trackedMock`/`makePrisma`) unit-test convention for
  exercising Prisma-layer CAS logic without a live database. Mirrored for
  the new `prisma-project-intake-store.test.mjs`.

## Scope Decision (the "prioritize making the flow work" override)

A fully exhaustive Q-CONC-1 would retrofit CAS onto every one of the ~20
`saveIntake` call sites throughout `intake-workflow-service.ts` (draft
saves, plan saves, evaluation saves, etc.), each requiring the calling code
to thread through the `updatedAt` it read before mutating. That's a much
larger, higher-risk refactor with a real chance of introducing new bugs
under this scope.

Instead: added CAS support to the store layer (both `PrismaProjectIntakeStore`
and `InMemoryProjectIntakeStore`, matching the interface's new overload) and
wired it into exactly one place — `applyTransitionToRecord` — which is the
**sole choke point every workflow status transition in the entire app routes
through** (submit, approve, reject, provisioning, distribution, the
`generate_evaluation`/`success` pair TASK-0057 was about, all of it). This
closes the actual concern (silent last-write-wins status corruption during a
race) at high leverage without touching business logic anywhere else. Other
non-transition `saveIntake` calls (e.g. saving draft content before the final
status transition) remain plain, non-CAS writes — an accepted, documented
residual risk, narrower in consequence than the status-corruption class this
closes.

For Q-CONC-2, similarly scoped: added a `linkedIntakeId` field to
`DiscoverySession` (persists automatically — the session is already stored
as an opaque JSON snapshot, so no migration) and one idempotency check at
the top of `sendToEvaluation()`. Did not add session-level locking; the
frontend's own button-disable-once-`sent_to_evaluation` behavior already
prevents the common case, and a genuine simultaneous double-POST (two tabs,
same instant) is accepted as a residual edge case, consistent with the
Q-CONC-1 scoping decision above.

## Changes

### Q-CONC-1

- `src/application/types.ts` — `ProjectIntakeStore.saveIntake` gained a
  second overload: `saveIntake(record, { expectedUpdatedAt }): Promise<ProjectIntakeRecord | null>`.
  Omitting the options object keeps the original non-nullable signature —
  every existing call site is source-compatible, unchanged.
- `src/application/in-memory-store.ts` — `InMemoryProjectIntakeStore.saveIntake`
  implements the CAS check (compares `options.expectedUpdatedAt` against the
  currently-stored record's `updatedAt`; returns `null` on mismatch).
- `apps/api/src/persistence/prisma-project-intake-store.ts` —
  `PrismaProjectIntakeStore.saveIntake` implements CAS via `updateMany` with
  `updatedAt` in the WHERE clause (single atomic statement, no separate
  `SELECT ... FOR UPDATE`), inside the existing `$transaction`. A row that
  doesn't exist yet always proceeds as a plain `create` (nothing to conflict
  with). Provisioning-plan mirroring is skipped entirely when CAS fails.
- `src/application/intake-workflow-service.ts` — `applyTransitionToRecord`
  rewritten as a bounded retry loop (`MAX_TRANSITION_ATTEMPTS = 3`, matching
  the discovery store's convention): on CAS conflict, re-reads the intake;
  if the fresh status already equals the transition's target (computed via
  `getNextStatus`), returns the fresh record as a benign no-op (someone else
  already completed the exact same transition); otherwise retries against
  the fresh record. Exhausted retries throw `ConflictError`. Records that
  predate `updatedAt` being populated fall back to a plain (non-CAS) write.

### Q-CONC-2

- `src/domain/discovery.ts` — added `linkedIntakeId?: string` to
  `DiscoverySession`.
- `src/application/discovery/discovery-orchestrator.ts` —
  `sendToEvaluation()`: if the session is already `sent_to_evaluation` and
  has a `linkedIntakeId`, look it up and return it instead of building a new
  `intakeRecord`. Falls through to the normal create path if the linked
  intake can't be found (self-heals rather than getting stuck). The normal
  path now also writes `linkedIntakeId: savedIntake.id` onto the session.

## Testing

- New regression tests:
  - `tests/intake-workflow-service.test.mjs` — simulates one CAS conflict
    via a monkey-patched `store.saveIntake`, asserts `applyTransitionToRecord`
    retries and succeeds (not throws).
  - `tests/api/prisma-project-intake-store.test.mjs` (new file, mirrors
    `prisma-discovery-session-store.test.mjs`'s fake-Prisma pattern) — 4
    tests: create-when-absent, CAS success, CAS conflict returns null and
    skips the write, plain no-options call still upserts unconditionally.
  - `tests/discovery-phase-3.test.mjs` — calls `sendToEvaluation` twice on
    the same session with a real `InMemoryProjectIntakeStore` configured;
    asserts the second call returns the same intake ID and that only one
    intake exists afterward.
- `npm run typecheck` (core) and `npx tsc -p apps/api/tsconfig.json --noEmit`
  — both clean.
- `npm test` (core, 777 tests incl. 2 new) — 776 pass; the 1 failure
  (`monday-config.test.mjs`) is the same pre-existing, unrelated,
  untracked-in-progress test noted in TASK-0057.
- `npm run test:api` (7 tests incl. 4 new) — all pass.

## Not Changed

- Did not retrofit CAS onto every non-transition `saveIntake` call site —
  see Scope Decision above. If a future incident traces back to one of
  those (e.g. draft content silently overwritten by a concurrent generation
  attempt), that's the next place to look.
- Did not add session-level locking for `sendToEvaluation()` — the top-of-
  function idempotency check covers the realistic case; a true simultaneous
  double-POST is an accepted residual gap.
- Did not add a live-database integration test (e.g. against a real
  Postgres) for either CAS path — the fake-Prisma unit tests match this
  codebase's existing convention for testing Prisma-layer concurrency logic
  without one (see `prisma-discovery-session-store.test.mjs`, which does the
  same).

## Follow-up

- Q-CONC-1 and Q-CONC-2 in `OPEN_QUESTIONS.md` updated from `open` to
  `implemented` (scoped as described above, not exhaustively).

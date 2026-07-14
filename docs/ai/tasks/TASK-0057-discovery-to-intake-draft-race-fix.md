# TASK-0057 — Discovery → Intake handoff: "flow is broken when draft already ready"

## Request

User reported: "discovery passes onto the start of intake, when it already
has the draft ready the flow is broken." Investigated via `superpowers:systematic-debugging`
+ `/investigate` (root-cause phases) rather than guessing at a fix.

## Context Read

- `docs/product/workflow-state-machine.md` — request status enums and the
  `generate_evaluation` transition guard live here; confirmed it only fires
  from `"submitted"`.
- `docs/product/failure-and-recovery.md` — background job / retry behavior
  conventions (relevant since the actual bug is in a fire-and-forget job).
- Read `src/domain/workflow.ts`, `src/application/intake-workflow-service.ts`,
  `src/application/discovery/discovery-orchestrator.ts`,
  `apps/api/src/modules/discovery/discovery.controller.ts`,
  `apps/web/src/app/discovery/[id]/page.tsx`,
  `apps/web/src/app/intakes/[id]/page.tsx`,
  `apps/web/src/components/discovery/DiscoveryChat.tsx`.

## Root Cause

`discovery.controller.ts`'s `POST /discovery/:id/send-to-evaluation` creates
the intake, then fires `workflowService.generateMockAnalysisDraft(intake.id, ...)`
**unawaited** ("fire evaluation in the background — don't block the
response," `discovery.controller.ts:224-228`). The frontend navigates to
`/intakes/{id}` immediately on the HTTP response, before that background job
necessarily finishes. The intake page shows a "Generate Mock AI Draft" button
whenever `["submitted","intake_review"].includes(status) && !hasDraft`
(`intakes/[id]/page.tsx:145,183`) — true at the moment of landing, since the
client's fetched state predates the background job's completion. There is no
polling to refresh that state once the background job finishes.

`IntakeWorkflowService.generateMockAnalysisDraft` (and its orchestrator-path
delegate `generateEvaluation`) treated `record.status !== "evaluating"` as
"safe to (re-)attempt the `generate_evaluation` transition" — a guard that
only accounted for one specific resume case (crashed after transitioning to
`evaluating`, before the draft was written). It did not account for the
already-ready case (`status === "intake_review"`, draft already present).
Per `workflow.ts:44`, `generate_evaluation` is only a valid transition from
`"submitted"` — attempting it again once the draft is ready and status has
moved to `"intake_review"` throws `InvalidTransitionError` unconditionally.

So: any time the background auto-draft job finishes before/during a second
call to the same function — a manual "Generate Mock AI Draft" click racing
it (the realistic, easily-hit case, since the button is visibly present
right after redirect with no "already generating" indicator), or a retried
request — the second call crashes instead of no-op'ing. This is the "flow
is broken" the user hit: the fire-and-forget draft generation is the normal
path for every Discovery-originated intake (proposal/manifest generation
being automatic per TASK-0054), so this isn't a rare edge case.

## Fix

`src/application/intake-workflow-service.ts` — `generateMockAnalysisDraft`:
added a single idempotency guard at the top (before the orchestrator-path
delegation, so both the mock-provider path and the real-orchestrator path
route through it): if the intake already has `latestAnalysisDraft` and its
status isn't `"evaluating"` (i.e. it's not mid-flight), return the record
as-is instead of re-attempting the transition. This is the sole choke point
both callers (`discovery.controller.ts`'s background call and
`intake.controller.ts`'s `POST /:id/analysis-drafts/mock`, used by the
manual button) route through — one guard, not one per caller.

## Testing

- Added a regression test in `tests/intake-analysis-draft.test.mjs`:
  calls `generateMockAnalysisDraft` twice on the same intake, asserts the
  second call returns the same draft/status instead of throwing.
- Verified red→green: temporarily stripped the guard from the compiled
  output — confirmed the new test fails with exactly
  `InvalidTransitionError: Invalid workflow transition: intake_review ->
  generate_evaluation` (the real user-facing crash) — then rebuilt from
  source and confirmed it passes.
- `npm run typecheck` — clean.
- `npm test` (779 tests incl. new one) — 778 pass; the 1 failure
  (`tests/monday-config.test.mjs`) is pre-existing and unrelated — an
  untracked, in-progress test file for a feature (`monday-config.ts`) not
  yet wired into `src/index.ts` exports, from a different in-progress task.

## Not Changed

- Did not add optimistic-concurrency (CAS) to
  `apps/api/src/persistence/prisma-project-intake-store.ts`. It's a plain
  upsert with no `updatedAt`-based compare-and-swap, unlike
  `prisma-discovery-session-store.ts` which has one. This means a genuine
  simultaneous-initial-read race (both the background job and a manual call
  reading `status: "submitted"` before either has written) is still
  possible in principle, though far narrower than the bug just fixed (that
  one triggered on *any* call after the draft was ready, not just a
  microsecond-window double-read). Adding CAS here touches core persistence
  idempotency guarantees — a bigger, separately-reviewable change per
  CLAUDE.md's "changing retry, idempotency, or dead-letter behavior"
  confirmation requirement. Logged as Q-CONC-1 below instead of bundling it
  into this fix.
- Did not add a guard against `discovery-orchestrator.ts`'s `sendToEvaluation()`
  being called twice (it unconditionally builds a new `intakeRecord` via
  `proposalToIntakeRecord(...)` every call — a repeat call would create a
  second, orphaned intake). The frontend's "Send to Evaluation" button
  disables once `session.status === "sent_to_evaluation"`, so this requires
  a tighter double-click-before-response race than the bug just fixed, and
  isn't what the user's report describes (an orphaned duplicate record isn't
  a visibly "broken" flow the way a thrown error is). Logged as Q-CONC-2.

## Follow-up

- Q-CONC-1, Q-CONC-2 added to `OPEN_QUESTIONS.md`.

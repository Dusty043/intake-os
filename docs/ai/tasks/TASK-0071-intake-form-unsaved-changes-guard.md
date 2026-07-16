# TASK-0071 Intake form unsaved-changes guard

## Request

Task 4 (lowest priority, last) of the plan in
`docs/superpowers/plans/2026-07-16-live-streaming-verification-and-ui-qol.md`: add a
lightweight unsaved-changes guard to the intake form so a user doesn't lose typed input
by accidentally leaving the tab.

## Context Read

- [x] `docs/ai/tasks/TASK-0066-live-streaming-verification-and-ui-qol-plan.md`
- [x] `apps/web/src/app/intakes/new/page.tsx` (post-TASK-0069 state)
- [x] `apps/web/src/lib/intake-form-validation.ts` (added in TASK-0069)

## Plan

Add a `beforeunload` warning when the form has unsaved (dirty) input. Explicitly NOT
full localStorage draft persistence — that's speculative scope beyond what was asked
for; Discovery's chat already owns the equivalent AI-path case.

## Changes

- `apps/web/src/lib/intake-form-validation.ts`: added `isIntakeFormDirty(form)` — true
  if any field is non-empty.
- `apps/web/src/app/intakes/new/page.tsx`: added a `useEffect` registering a
  `beforeunload` handler that calls `e.preventDefault()` / sets `e.returnValue` when
  `isIntakeFormDirty(form)` is true; cleans up the listener on unmount.

## Commands Run

```bash
npm run build:core   # clean
npm test             # 795/795
npm --prefix apps/web run test  # 34/34, includes new page.test.tsx dirty-check case
npm --prefix apps/web run typecheck  # clean
```

## Test Results

- `apps/web/src/app/intakes/new/__tests__/page.test.tsx`: dirtying a field registers the
  `beforeunload` handler (asserted via a spy on `addEventListener`/simulated event with
  `preventDefault` called).
- Live browser verification (this session): typed a title into the form, then clicked
  the "Intakes" sidebar link (an in-app Next.js client-side navigation) — navigated away
  with no confirm prompt. This is expected and by design, not a bug: `beforeunload` only
  fires on a true document unload (tab close, external link, full reload), not SPA
  client-side routing, and the plan explicitly scoped this to `beforeunload` only
  ("Explicitly NOT full localStorage draft persistence... NOT full draft persistence"),
  not an in-app nav-away confirm. Did not re-verify the actual native
  "leave site?" browser prompt live, since automated browser tooling does not reliably
  trigger/observe `beforeunload` dialogs; the unit test above covers the handler logic
  directly.

## Decisions

- Scoped to `beforeunload` only, per TASK-0066's plan — no in-app nav-away confirm (e.g.
  intercepting `next/navigation` router pushes) and no localStorage draft persistence.
  Both were explicitly named as out-of-scope/YAGNI in the plan: Discovery's chat already
  owns the equivalent "don't lose your AI-guided conversation" case, and a full draft-save
  feature is speculative beyond what was asked for.

## Open Questions

- If a future request wants unsaved-changes protection for in-app navigation too (e.g.
  clicking "Cancel" or a sidebar link away from a dirty form), that needs a distinct
  mechanism (router-level intercept or a confirm-before-navigate hook) — not covered by
  this task, noted here rather than in OPEN_QUESTIONS.md since it's speculative, not a
  known gap someone asked about.

## Handoff

Item 4 of TASK-0066's plan is complete. All four plan items (Q-UX-1 verification, intake
validation UX + dead field cleanup, Discovery a11y/toast audit, unsaved-changes guard)
are now implemented, tested, and documented. TASK-0066 is closed out.

# TASK-0070 Discovery view-intake link fix + a11y/toast audit

## Request

Task 3 of the plan in `docs/superpowers/plans/2026-07-16-live-streaming-verification-and-ui-qol.md`:
fix the "View intake" link bug, add an `aria-live` region for streaming stage labels,
and audit `Toast.tsx` call sites for missing success toasts.

## Context Read

- [x] `docs/ai/tasks/TASK-0066-live-streaming-verification-and-ui-qol-plan.md`
- [x] `apps/web/src/app/discovery/page.tsx`, `apps/web/src/app/discovery/[id]/page.tsx`
- [x] `apps/web/src/components/discovery/DiscoveryChat.tsx`
- [x] `apps/web/src/components/Toast.tsx` call sites in `apps/web/src/app/intakes/[id]/page.tsx`

## Plan

1. Fix the "View intake →" link bug: it read `localStorage.getItem('pit:discovery:intake:'+id)`
   instead of the server-persisted `session.linkedIntakeId`, so the link silently
   disappeared on another device/browser or after clearing storage.
2. Add an `aria-live="polite"` region around the streaming stage-label text so screen
   readers announce stage transitions (currently silent).
3. Audit `Toast.tsx` call sites: confirm Submit, Approve Gate 1, Approve Gate 2, and
   Execute Distribution all fire a success toast; wire up any that don't.

## Changes

- `apps/web/src/lib/discovery-types.ts`: added `linkedIntakeId?: string` to the
  `DiscoverySession` type (already returned by the API per Q-CONC-2/TASK-0058, just not
  typed on the frontend).
- `apps/web/src/app/discovery/[id]/page.tsx`: removed the `linkedIntakeId` local state
  and its `localStorage.getItem`/`setItem` read/write; the "View intake →" link now reads
  `session.linkedIntakeId` directly. No fallback — server is authoritative.
- `apps/web/src/app/discovery/page.tsx`: removed the `getLinkedIntakeId` localStorage
  helper; the session-list "View intake" link now reads `session.linkedIntakeId`
  directly for `sent_to_evaluation` sessions.
- `apps/web/src/components/discovery/DiscoveryChat.tsx`: the streaming-stage-label
  `<span>` in the conversation header is now always mounted with `aria-live="polite"`
  (previously only rendered — and thus only present in the DOM — while `busy`), so a
  screen reader gets one stable live region to announce into rather than an
  element that mounts/unmounts mid-conversation.
- `apps/web/src/app/intakes/[id]/page.tsx`: `DistributionTab` gained an `onSuccess`
  callback prop, wired to the page's existing `successMsg` toast state, fired after
  `executeDistribution` succeeds ("Distribution executing. Track progress below.").
  Submit, Approve Gate 1, and Approve Gate 2 were already wired to toasts before this
  task — Execute Distribution was the one gap found in the audit.

## Commands Run

```bash
npm run build:core   # clean
npm test             # 795/795
npm --prefix apps/web run test  # 34/34, includes new page.test.tsx (discovery) and
                                  # DiscoveryChat.test.tsx cases, plus DistributionTab.test.tsx
npm --prefix apps/web run typecheck  # clean
```

## Test Results

- `apps/web/src/app/discovery/__tests__/page.test.tsx` (new): session-list "View intake"
  link renders from `session.linkedIntakeId`, not localStorage.
- `apps/web/src/components/discovery/__tests__/DiscoveryChat.test.tsx` (new): the
  stage-label region has `aria-live="polite"` and is present in the DOM regardless of
  `busy` state.
- `apps/web/src/app/intakes/[id]/__tests__/DistributionTab.test.tsx` (new): clicking
  "Execute Distribution" calls `onSuccess` with a message matching `/executing/i`.
- Live browser verification (this session): confirmed via `document.querySelectorAll('[aria-live]')`
  that a `<span aria-live="polite">` is present in the Discovery conversation view
  before and after sending a message (always mounted, as intended — its content is only
  populated while `busy`, and this session's mock-provider responses resolved too fast
  to catch non-empty text mid-request, but the source diff confirms
  `progressText(activeStages)` renders inside it whenever `busy` is true). Also created a
  fresh Discovery session end-to-end via the browser (mock AI provider) to confirm no
  regressions from the `linkedIntakeId` typing change.
- Distribution toast and the "View intake" link's non-owner-device behavior were not
  re-exercised live in this session (would require driving a session through
  Gate 1/Gate 2/provisioning first) — covered by the new unit tests above instead.

## Decisions

- No fallback to localStorage was kept for `linkedIntakeId` — per TASK-0066's plan,
  server is authoritative and the bug was specifically that localStorage was
  device/browser-scoped while the underlying data is not.
- Submit/Gate 1/Gate 2 toasts were confirmed already-present during the audit; only
  Execute Distribution needed wiring, so this task's diff is scoped to that one gap
  rather than touching all four call sites.

## Open Questions

None new.

## Handoff

Item 3 of TASK-0066's plan is complete. The `aria-live` region is structurally correct
(always mounted, populated conditionally) per the component diff; a live mid-stream
screen-reader check with a real/slow provider (not mock) would be the natural follow-up
if this needs re-verification beyond code + unit-test confirmation.

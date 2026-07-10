# TASK-0053 — Fix: new Discovery sessions never auto-advance to Solutions

## Context

Found live on oreochiserver immediately after deploying PR #33 (Q-UX-1 live-streaming):
a brand-new Discovery session sent via the "Start Discovery" modal reached
`problem_framed` with `solutionOptions: []` and then never progressed — the
"Solutions" timeline step stayed `Pending` forever, with no button anywhere
in the UI to trigger it manually.

## Root Cause

`apps/web/src/app/discovery/[id]/page.tsx`'s `handleSendMessage` (used for
*follow-up* messages in an existing session) already auto-chains into
`generateSolutions()` when a reply lands in `problem_framed` with no
solutions yet:

```ts
if (updated.status === "problem_framed" && updated.solutionOptions.length === 0) {
  return generateSolutions(id, actor);
}
```

`apps/web/src/app/discovery/page.tsx`'s `handleStart` (used for the *first*
message that creates the session) had no equivalent check — it called
`startDiscovery()` and navigated straight to the session page. Since the
first message can itself land directly in `problem_framed` (confirmed live
against the real OpenAI provider: intent + problem frame generated in one
call), every new session had a real chance of getting stuck with zero path
forward, since no manual "Generate Solutions" button exists either
(confirmed absent from `DiscoveryUnderstanding.tsx`).

Confirmed directly against the live server: session `discovery-mre0n6ut-1`
sat at `status: "problem_framed"`, `solutionOptions: []` indefinitely.

## Fix

`apps/web/src/app/discovery/page.tsx` — `handleStart` now mirrors the same
check before navigating:

```ts
let session = await startDiscovery(message, actor);
if (session.status === "problem_framed" && session.solutionOptions.length === 0) {
  session = await generateSolutions(session.id, actor);
}
router.push(`/discovery/${session.id}`);
```

## Testing

- `npx tsc --noEmit` (apps/web) — clean.
- Live-verified in browser (mock provider): a first message that stays in
  `conversation_started` (clarifying question) correctly does *not* trigger
  the new branch — confirms no regression on the already-working path.
- Did not reproduce the `problem_framed`-on-first-message path under mock
  (mock's simulated response asked a clarifying question instead); relying
  on the real-provider live repro above plus the pattern being an exact
  mirror of the already-shipped, working `handleSendMessage` branch.
- No existing unit-test convention for these page-level handlers
  (`handleSendMessage`'s identical pre-existing branch also has none) —
  consistent with that, no new test file added.

## Not Changed

- Did not manually unstick the pre-existing stuck session
  (`discovery-mre0n6ut-1`) on the server — it's disposable test data; a new
  session created after this deploys will work correctly instead.

## Follow-up

- None new. Worth noting for a future session: no manual "Generate
  Solutions" fallback button exists anywhere in the UI — if another status
  transition is ever added without an auto-chain, sessions could get stuck
  the same way again with no recovery path.

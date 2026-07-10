# TASK-0054 — Discovery UI: automatic proposal/manifest + collapsed clarifications

## Request

Two UX complaints after live use of the deployed Discovery flow:

1. Proposal and manifest generation required manual button clicks in the
   right sidebar; make them automatic, and show the result in the center
   chat panel instead of the sidebar.
2. Clarification question cards dominated too much of the chat panel's
   visual space.

## Context Read

- `apps/web/src/app/discovery/[id]/page.tsx`, `DiscoveryChat.tsx`,
  `DiscoveryUnderstanding.tsx`, `DiscoveryLayout.tsx`
- `src/application/discovery/discovery-orchestrator.ts` — confirmed
  `generateManifest()` already auto-composes the proposal internally if
  missing (`if (!session.proposal || session.proposal.status === "draft") { session = await this.composeProposal(sessionId); }`),
  so one API call gets both artifacts.
- Register: `product` (per PRODUCT.md via `impeccable` skill) — restrained
  color, density with clarity, "modal as first thought" banned, progressive
  disclosure preferred over stacked panels.

## Changes

### Automatic proposal + manifest (`discovery/[id]/page.tsx`)

`handleSelectDirection` now chains straight into `generateManifest()` when
the result lands in `direction_selected` with no manifest yet — one extra
API call, no user action required:

```ts
const handleSelectDirection = async (solutionId: string) => {
  await withBusy(async () => {
    const updated = await selectDirection(id, solutionId, actor);
    if (updated.status === "direction_selected" && !updated.manifest) {
      return generateManifest(id, actor);
    }
    return updated;
  });
};
```

Removed `handleGenerateProposal`/`handleGenerateManifest` and the
`generateProposal` import — no longer needed. `handleSendToEvaluation`
stays manual and untouched, matching the product's human-approval-authority
principle: AI drafts (proposal, manifest) automatically, but the act of
handing off to Evaluation remains a deliberate user action.

### Proposal/manifest moved to the center panel (`DiscoveryChat.tsx`)

New `ProposalCard`/`ManifestCard` components render inline in the message
flow (after the last message, in the same scrolling area) instead of in
`DiscoveryUnderstanding.tsx`'s right sidebar. `ManifestCard` carries the
"Send to Evaluation" button (moved from the sidebar). `DiscoveryChat` gained
`proposal`, `manifest`, `discoveryStatus`, `onSendToEvaluation` props.

`DiscoveryUnderstanding.tsx` lost the Proposal section, Manifest section,
and the two manual "Generate Proposal"/"Generate Manifest" buttons, plus
the now-unused `status`, `proposal`, `manifest`, `onGenerateProposal`,
`onGenerateManifest`, `onSendToEvaluation` props and their type imports.
It's now purely: Confidence, Detected Intent, Problem Frame, Solution
Options (unchanged — selecting a direction is a deliberate decision,
correctly stays in the sidebar).

### Clarifications collapsed by default (`DiscoveryChat.tsx`)

New `ClarificationDrawer` component replaces the always-expanded stacked
block with a single-row summary (`"N questions to clarify ▼"`, red dot if
any question is `blocking`, amber otherwise) that expands to the existing
`ClarificationCard` list only on click. Default state is collapsed —
directly addresses "blocks the chat significantly". The "Proceed with
assumptions" action is a sibling button in the same row, not nested inside
the toggle button (avoids invalid nested-interactive-element HTML).

## Testing

- `npx tsc --noEmit` (apps/web) — clean.
- `npx vitest run` (apps/web) — 14/14 pass, no regressions.
- `npm run web:build` — clean production build, lint clean.
- **Live-verified in browser** (mock provider, `api-mock`/`web-mock`):
  drove a full session start → clarification (drawer collapsed by default,
  expanded correctly on click, answer flow unchanged) → solutions →
  selected a direction → confirmed the Proposal and Manifest cards
  auto-appeared inline in the center panel with zero manual clicks →
  clicked "Send to Evaluation" → confirmed it created and navigated to a
  real intake record. No console errors.

## Not Changed

- Backend orchestrator/API — `generateManifest`'s existing
  auto-compose-proposal-if-missing behavior was reused as-is, not modified.
- Solution selection UI (sidebar cards) — user didn't ask to move this, and
  it's a deliberate human decision point, appropriately still in the
  sidebar.
- No new automated test for the page-level auto-chain logic — consistent
  with the existing convention in this codebase (TASK-0053's identical
  `handleSendMessage` auto-chain pattern also has none); relied on live
  browser verification instead.

## Follow-up

None new.

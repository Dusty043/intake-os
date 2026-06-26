# TASK-DISCOVERY-PHASE6: Frontend UI

**Date:** 2026-06-26
**Phase:** Discovery Engine Phase 6
**Status:** Complete

## Objective

Add a full Discovery Engine UI to the Next.js web app: a session list page, a three-panel session view (timeline / chat / understanding), and all action buttons for the full discovery pipeline.

## Files Added

### API Client + Types
- `apps/web/src/lib/discovery-client.ts` — typed fetch wrappers for all 10 discovery endpoints; uses `actorHeaders(actor)` matching existing app pattern
- `apps/web/src/lib/discovery-types.ts` — TypeScript types for `DiscoverySession`, all sub-types; mirrors domain types without importing from domain bundle

### Pages
- `apps/web/src/app/discovery/page.tsx` — session list with status badge table, refresh button, start modal trigger; empty state with CTA
- `apps/web/src/app/discovery/[id]/page.tsx` — three-panel session view; all action handlers (`sendMessage`, `answerClarification`, `selectDirection`, `generateProposal`, `generateManifest`, `sendToEvaluation`); auto-navigates to intake on `sendToEvaluation` if `intakeRecord.id` is returned

### Components
- `apps/web/src/components/discovery/DiscoveryLayout.tsx` — three-column flex layout (timeline 224px | chat flex-1 | understanding 288px)
- `apps/web/src/components/discovery/DiscoveryTimeline.tsx` — vertical stepper for all 10 statuses with past/current/future states and event timestamps
- `apps/web/src/components/discovery/DiscoveryChat.tsx` — message bubbles, clarification card accordion, typing indicator, textarea input with Enter-to-send
- `apps/web/src/components/discovery/DiscoveryUnderstanding.tsx` — 6 confidence bars, intent badge, problem frame details, solution option cards with Select direction, proposal epics, manifest summary, action buttons
- `apps/web/src/components/discovery/DiscoveryStartModal.tsx` — modal overlay for starting a new session
- `apps/web/src/components/discovery/DiscoveryStartForm.tsx` — textarea form used inside start modal

## Design Decisions

- All pages use `"use client"` with `useActor()` (no Server Components) — matches existing `intakes/page.tsx` pattern
- `sendToEvaluation` navigates to intake page if `intakeRecord.id` is present; otherwise stays on session page (handles mock adapter where no intake is persisted yet)
- `handleSendMessage` auto-triggers `generateSolutions` if `session.status === "problem_framed"` and solutions not yet generated
- CSS classes: `btn-primary`, `btn-secondary`, `section-label`, `card`, `form-textarea`, `text-brand-muted` — all from existing global CSS; no new styles added

## Checks

- `npx tsc -p apps/web/tsconfig.json --noEmit` — clean

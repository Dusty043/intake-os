# TASK-0066 Live-streaming verification + UI/intake QoL plan (2026-07-16)

## Request

Plan (not yet implement) today's auth + UI work. Scoped down through discussion to:
1. Verify the already-built Discovery live-streaming feature (Q-UX-1) against the deployed
   oreochiserver environment, including its auth-gated SSE route, then merge/PR it.
2. Fix two bugs found while compiling a UI QoL backlog.
3. Ship three QoL groups bundled with the bugs they naturally touch.

This is a planning doc, not an implementation log — `Changes`/`Commands Run`/`Test Results`
will be filled in per work item as each is implemented (this repo's existing task-log
convention is one file per fix; this doc is the umbrella plan referenced by those).

## Context Read

- [x] `CLAUDE.md`
- [x] `docs/ai/PROJECT_MEMORY.md`
- [x] `docs/ai/OPEN_QUESTIONS.md` (Q-UX-1, Q-AUTH-1, Q-AUTH-2, Q-DIST-1, Q-DISC-1, Q-CONC-1/2)
- [x] `docs/ai/tasks/TASK-0048` through `TASK-0052` (live-streaming build chain)
- [x] `docs/ai/tasks/TASK-0035-ux-friction-backlog.md`
- [x] `src/auth-config-validator.ts`
- [x] `apps/web/src/app/intakes/new/page.tsx`, `apps/web/src/app/discovery/page.tsx`,
      `apps/web/src/app/discovery/[id]/page.tsx`

## Plan

Sequenced so related touches happen in one pass; each numbered item becomes its own
TASK-00xx log (starting at TASK-0067) when implementation begins.

### 1. Verify Q-UX-1 (Discovery live-streaming) on oreochiserver
- Deploy the existing `feat/discovery-live-streaming` branch (5 commits, TASK-0048–0052)
  to oreochiserver via the `deploy-oreochi` skill.
- Verify the SSE route's `requireOwnedSession` auth guard against the deployed server's
  real `AUTH_MODE=dev_headers` config: curl the stream endpoint with
  `X-Actor-Id`/`X-Actor-Role`/`X-Actor-Name` headers (per established debugging workflow)
  to confirm events arrive and an unauthenticated/mismatched-owner request is rejected.
- Confirm in-browser that the frontend consumer renders live stage labels
  ("Understanding your request…" etc.) during a real (non-mock) Discovery turn.
- If broken: minimal fix, redeploy, recheck — same loop as the prior session's bug chain.
- If it works: open a PR from `feat/discovery-live-streaming` (per this session's chosen
  git workflow — PRs, not direct-to-main), merge once green, close out Q-UX-1 in
  `OPEN_QUESTIONS.md`.

### 2. Bug fix + Intake form validation UX (same file, one pass)
File: `apps/web/src/app/intakes/new/page.tsx`
- **Bug**: client validation only checks non-empty description; API requires
  `MIN_INTAKE_DESCRIPTION_LENGTH` (20 chars, `apps/api/src/common/validation-constants.ts`).
  Add matching client-side min-length check + inline hint before submit, not just after a
  failed request.
- Add max-length `maxLength` attrs + live character counters for title/description/
  requester/department, matching the server-side caps in `validation-constants.ts`.
- Replace the single top-of-form `ErrorBanner` with per-field inline errors (map API 400
  validation failures to the offending field).
- Import `PROJECT_TYPES` from the shared domain enum (`src/domain/types.ts` or wherever
  `ProjectType` is canonically defined) instead of the hardcoded inline array, to remove
  drift risk if the registry changes.
- Delete the unused `SOURCES` array (lines 24-32) — no backend `source` field exists to
  receive it, and only "Manual" is meaningful until email/Chat intake sources are built.
  Decision confirmed with user: delete, don't wire up.

### 3. Bug fix + Discovery a11y/toast audit (same area, one pass)
Files: `apps/web/src/app/discovery/page.tsx`, `apps/web/src/app/discovery/[id]/page.tsx`
- **Bug**: the "View intake →" link reads `localStorage.getItem('pit:discovery:intake:'+id)`
  instead of the server-persisted `session.linkedIntakeId` (already returned by the API per
  Q-CONC-2/TASK-0058), so the link silently disappears on another device/browser or after
  clearing storage. Switch to reading `session.linkedIntakeId` directly; remove the
  localStorage read/write entirely (no fallback — server is always authoritative here).
- Add an `aria-live="polite"` region around the streaming stage-label text so screen
  readers announce stage transitions (currently silent).
- Audit `components/Toast.tsx` call sites: confirm Submit, Approve Gate 1, Approve Gate 2,
  and Execute Distribution actions all fire a success toast; wire up any that don't.

### 4. Draft-save / dead-field cleanup (lowest priority, last)
File: `apps/web/src/app/intakes/new/page.tsx`
- Add a lightweight unsaved-changes guard: dirty-check the form state and warn via
  `beforeunload` (and/or an in-app nav-away confirm) if the user has entered data and
  tries to leave. Explicitly NOT full localStorage draft persistence — that's speculative
  scope beyond what was asked for; Discovery's chat already owns the equivalent AI-path
  case.

## Changes

_Not yet made — planning only. Each item above gets its own task log and BUILD_LOG entry
when implemented._

## Commands Run

```bash
# none yet — planning session
```

## Test Results

_N/A — planning session._

## Decisions

- **Q-UX-1 verification environment**: deployed oreochiserver, not local (local has a
  known Postgres port conflict; oreochiserver already has the established curl+logs
  debugging loop and a way to reach a real OpenAI provider).
- **Dead `SOURCES` field**: delete rather than wire up. No backend field exists yet;
  only "Manual" is meaningful until other intake sources are actually built.
- **Git workflow for this batch**: feature branch + PR per item (not the direct-to-main
  fast-iteration pattern used in the 2026-07-16 bug-fix chain) — user's explicit choice
  for this batch, does not change the standing preference in
  `debugging-workflow-preference` memory for future sessions.
- **Draft-save scope**: dirty-check + `beforeunload` warning only, not full draft
  persistence — kept deliberately small (YAGNI) since the AI-path equivalent already
  exists in Discovery.

## Open Questions

- Q-DIST-1 and Q-DISC-1 (both already open in `OPEN_QUESTIONS.md`) are out of scope for
  this batch — noted during QoL discovery as things that could visibly look like "wrong"
  AI draft output but aren't UI/auth bugs.
- Whether `PROJECT_TYPES` in the frontend should import directly from a shared package/
  module or whether the domain enum needs to be re-exported for frontend consumption —
  to be resolved during implementation of item 2 (may need a small shared-types wiring
  change, not just a frontend edit).

## Handoff

This doc is the umbrella plan for today's session. Next step: hand off to the
writing-plans process to produce a step-by-step implementation plan per item, starting
with item 1 (Q-UX-1 verification) since it unblocks merging an already-built branch
before other fixes land and cause drift against it.

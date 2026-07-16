# TASK-0068 Verify Discovery live-streaming (Q-UX-1) on oreochiserver

## Request

Task 1 of the plan in `docs/superpowers/plans/2026-07-16-live-streaming-verification-and-ui-qol.md`:
verify the already-built Discovery live-streaming feature (Q-UX-1) against the deployed
oreochiserver environment, including its auth-gated SSE route, then close it out.

## Context Read

- [x] `docs/ai/OPEN_QUESTIONS.md` (Q-UX-1 row)
- [x] `docs/ai/tasks/TASK-0048` through `TASK-0052` (original build chain)
- [x] `apps/api/src/modules/discovery/discovery.controller.ts` (`requireOwnedSession`, `streamSession`)

## Plan

1. Check whether `feat/discovery-live-streaming` still needs deploying.
2. Verify the SSE route with curl against a real session, both as owner and non-owner.
3. Verify oreochiserver's config actually exercises the real (non-mock) OpenAI path.
4. Close out Q-UX-1 in `OPEN_QUESTIONS.md`.

## Changes

None to application code. Documentation only: `docs/ai/OPEN_QUESTIONS.md` Q-UX-1 row updated
from "implemented, not yet shipped" to "shipped, verified 2026-07-16".

## Commands Run

```bash
git fetch origin
git merge-base --is-ancestor origin/feat/discovery-live-streaming origin/main
# => true: the branch was ALREADY merged into main via PR #33 (d2846e4), 22 commits before
# main's current tip (83d87ea). The OPEN_QUESTIONS.md note "No PR opened yet" was stale —
# no deploy/merge step was needed for this task.

ssh oreochiserver 'cd ~/intake-os && git rev-parse --short HEAD'
# => 83d87ea (matches origin/main tip — server is already running this code)

ssh oreochiserver 'cd ~/intake-os && grep -E "^AI_PROVIDER|^AUTH_MODE" .env.server'
# => AI_PROVIDER=openai, AUTH_MODE=dev_headers

# Created a real discovery session (real OpenAI call, not mock):
ssh oreochiserver 'curl -s -X POST http://localhost:8080/api/discovery ...'
# => discovery-mrnl0vyi-1, owned by userId "verify-user-1", status problem_framed,
#    usageRecords show provider:"openai", model:"gpt-5.6-terra" for intent_extraction
#    and problem_framing agents.

# Captured the SSE stream (as owner) while concurrently triggering generateSolutions:
ssh oreochiserver '
  ( curl -N -s -m 12 -H "x-actor-id: verify-user-1" ... "http://localhost:8080/api/discovery/discovery-mrnl0vyi-1/stream" > /tmp/sse-owner.log & )
  sleep 1
  curl -s -X POST ... ".../discovery-mrnl0vyi-1/solutions"
  sleep 6
  cat /tmp/sse-owner.log
'
# => streamed 100+ real events: stage-start (solution_generation, clarification),
#    dozens of token events with real per-token JSON fragments for both stages
#    (e.g. {"questions":[{"affectedDimensions":["scopeClarity",...) built up token
#    by token), stage-end for clarification. Confirms the SSE route correctly
#    streams DiscoveryStreamRegistry events from a real (non-mock) OpenAILlmClient
#    call, not just from tests.

# Verified the auth guard rejects a non-owner:
ssh oreochiserver 'curl -s -i -m 5 -H "x-actor-id: some-other-user" ... ".../discovery-mrnl0vyi-1/stream"'
# => HTTP/1.1 404 Not Found, {"message":"DiscoverySession not found: discovery-mrnl0vyi-1", ...}
# Matches requireOwnedSession's design: indistinguishable from a missing session.
```

## Test Results

No new automated tests — this was a live verification task against already-tested code
(TASK-0048–0052 covered the unit/e2e layer). Frontend rendering was not re-verified in a
live browser: the Browser tool's per-site approval gate blocked reading
`http://100.75.210.83:8080` (a raw Tailscale IP, gated for safety). User confirmed skipping
that step is acceptable — the curl capture proves the exact SSE event format
(`event: stage-start`/`token`/`stage-end`, `data: {...}`) that
`apps/web/src/lib/__tests__/discovery-client.test.ts` already unit-tests the frontend
parser against, so the rendering path has strong indirect coverage.

## Decisions

- No deploy or PR/merge was needed — the branch was already on `main` (a stale doc, not a
  stale deployment). This task was pure verification + doc correction.
- Left the test discovery session (`discovery-mrnl0vyi-1`, owned by `verify-user-1`) on the
  server rather than trying to delete it — no delete endpoint exists for discovery sessions,
  and it's harmless synthetic data (a fictional "vacation request tool" idea), not real user
  data. Noting it here so it isn't mistaken for a real user session later.
- Accepted curl + existing unit-test coverage as sufficient evidence in place of a live
  browser screenshot, per user's explicit choice when the browser tool was blocked.

## Open Questions

None new. Q-UX-1 is now closed.

## Handoff

Q-UX-1 is verified and closed. No code changes were needed or made. The remaining plan
tasks (2-7, the two UI bugs + three QoL items) are unaffected by this task and proceed
independently on the same branch/worktree.

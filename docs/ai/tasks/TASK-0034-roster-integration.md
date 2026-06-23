# TASK-0034: Roster Integration

**Status:** Complete  
**Date:** 2026-06-24  
**Branch:** main

## Goal

Wire the Roster API into the developer assignment recommendation flow. The API contract at `ai-team.simple.biz/api/roster` is unverified, so the integration degrades gracefully when the URL is not configured.

## What Was Built

### Core

- **`src/application/roster/roster-types.ts`** — `TeamMemberRosterRecord`, `ScoredRosterMember`, `RosterAssignmentResult`
- **`src/application/roster/roster-api-client.ts`** — HTTP client with 4-second timeout; normalizes any server response shape; returns empty array on any error
- **`src/application/roster/roster-scorer.ts`** — scoring: `skills_match + project_type_match + availability + capacity - risk_penalties`; returns ranked list with backup

### Integration

- `DeveloperAssignmentRecommendationDraft` extended with `rosterConnected`, `backupDeveloperId/Name`, `scoringSignals`
- `buildMockIntakeAnalysisDraft` accepts optional `rosterResult` — uses it when present, falls back to advisory stub
- `MockIntakeAnalysisProvider` optionally accepts `RosterApiClient`; fetches and scores before building draft
- `IntakeWorkflowService` accepts `rosterClient` option; passes to provider
- NestJS runtime module reads `ROSTER_API_URL` + `ROSTER_API_KEY` env vars at startup

### Manual Override

- `overrideAssignment(id, actor, developerName, reason, developerId?)` on service
- `clearAssignmentOverride(id, actor)` on service
- `POST /intakes/:id/assignment` and `DELETE /intakes/:id/assignment` endpoints
- `assignmentOverride` field on `ProjectIntakeRecord`

### UI

- `AssignmentCard` component: shows effective assignment (override takes precedence over recommendation), confidence bar, matched skills, workload signals, backup developer, override form
- Wired into AI Draft tab (visible when a draft exists)
- Override controls visible to `intake_owner`, `devops_lead`, `admin`

## Activation

Set these env vars on oreochiserver when the roster endpoint is live:
```
ROSTER_API_URL=https://ai-team.simple.biz/api/roster
ROSTER_API_KEY=<if required>
```

No code change needed. The client connects automatically when `ROSTER_API_URL` is set.

## Tests

10 unit tests in `tests/roster.test.mjs`: scorer ranking, skill matching, unavailable exclusion, backup selection, capacity penalties, client connection state.

Full suite: 592/592 pass.

## Open Questions

- Q-ROSTER-1: Does `ai-team.simple.biz/api/roster` require auth? What auth scheme?
- Q-ROSTER-2: Does it expose workload/capacity fields or only skills?
- Q-ROSTER-3: Are Monday user IDs and GitHub usernames in the response?
- Q-ROSTER-4: Is the endpoint production-stable or a prototype?

## Handoff

- Roster client is already wired in production code — just add the env var to activate
- Scorer normalizes case and underscores, handles partial data gracefully
- Override history is audited and stored on `ProjectIntakeRecord.assignmentOverride`
- Debug tab now restricted to admin role (ISSUE-003 also resolved in this task)

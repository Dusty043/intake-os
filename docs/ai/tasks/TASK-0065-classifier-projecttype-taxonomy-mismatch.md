# TASK-0065: Fix classifier emitting an unrecognized projectType, breaking provisioning

**Status:** Complete
**Date:** 2026-07-16

## Request

User progressed the same intake all the way to Gate 2 approval and clicked
"Generate Distribution Preview" — got "Unexpected application error." again.

## Investigation

TASK-0062's logging fix paid off immediately — no reproduction needed:

```
[ERROR] [ApplicationExceptionFilter] Unknown project type: ai_assistant
Error: Unknown project type: ai_assistant
    at getProjectTypeDefinition (project-type-registry.js:101)
    at buildDryRunProvisioningPlan (provisioning-plan.js:27)
    at IntakeWorkflowService.generateProvisioningPlan (intake-workflow-service.js:823)
```

## Root Cause

`openai-project-classifier-agent.ts`'s schema used an entirely different,
made-up `projectType` enum — `web_app, mobile_app, automation, dashboard,
ai_assistant, api_service, data_pipeline, infrastructure,
process_improvement, other` — that has almost nothing in common with the
canonical `ProjectType` enum in `src/domain/types.ts` (`n8n_automation,
data_sync_integration, internal_dashboard, internal_tool, client_portal,
saas_platform, api_service, ai_workflow_tool, discovery_research,
reporting_automation`) that `project-type-registry.ts` actually indexes.
Only `api_service` happened to overlap. This meant **every real (non-mock)
evaluation** produced a classification the provisioning pipeline couldn't
recognize — a systemic, 100%-reproducible bug, not specific to this intake.

Compounding it: `evaluation-draft-mapper.ts` blindly cast the classifier's
raw string with `as IntakeAnalysisDraft["projectType"]` — no validation — so
an invalid value sailed through evaluation and drafting, only crashing much
later, deep inside `generateProvisioningPlan`, far from where it originated.

## Fix

- `openai-project-classifier-agent.ts`: import `projectTypes` from
  `src/domain/types.ts` (single source of truth) and use it directly as the
  schema's enum, replacing the made-up list. Rewrote the system prompt to
  describe each of the 10 canonical types instead of the old ones.
- `evaluation-draft-mapper.ts`: added defense-in-depth — validate the
  classifier's `projectType` against `projectTypes` before trusting it;
  fall back to `internal_tool` (matching the existing no-classification
  fallback) instead of letting an invalid value propagate to a later crash.

## Tests

Added 1 case to `tests/evaluation-draft-mapper.test.mjs`: classification
returning an unrecognized `projectType` ("ai_assistant") falls back to
`internal_tool` instead of propagating. `npm run build:core` clean.
`npm test` — 795/795 pass, no regressions.

## Deploy

Committed and pushed to `main`, pulled + rebuilt + restarted on
oreochiserver, healthcheck passed. Retried "Generate Distribution Preview"
for the same intake to confirm (see BUILD_LOG for result).

## Correction — first deploy didn't fully fix it

Retried the exact failing call live after deploying the first two fixes:
**still** `Unknown project type: ai_assistant`. Traced further:
`buildDryRunProvisioningPlan` (`provisioning-plan.ts:60`) reads
`pkg?.projectType ?? intake.projectType` — `pkg` is the `ReviewedProjectPackage`
snapshotted at Gate 1 acceptance time, **not** re-derived from the evaluation
on each call. This intake's package was accepted before this session's fixes
landed, so its `projectType` is permanently `"ai_assistant"` — and approval
records are locked (CLAUDE.md), so it can't be re-accepted to pick up a
corrected value.

Added the same validate-or-fallback guard directly in
`provisioning-plan.ts`'s `buildDryRunProvisioningPlan`, right before
`getProjectTypeDefinition()` — this is the true final consumption point for
every provisioning-plan call, protecting already-approved/locked packages
too, not just future evaluations.

No dedicated unit test added for this last piece — no existing test file
covers `buildDryRunProvisioningPlan` and building full fixtures from scratch
was a larger investment than the session's cost situation could justify;
relied on live retry verification instead (confirmed in BUILD_LOG).

## Not Changed

- Did not re-classify/re-run evaluation for intakes already stuck with a
  bad `projectType` from before this fix — the `provisioning-plan.ts` guard
  makes distribution preview generation work for them going forward without
  needing to touch locked approval records.

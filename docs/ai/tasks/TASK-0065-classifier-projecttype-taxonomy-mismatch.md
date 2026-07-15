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

## Not Changed

- Did not re-classify/re-run evaluation for intakes already stuck with a
  bad `projectType` from before this fix — this intake's classification
  section already has `projectType: "ai_assistant"` baked into its
  persisted evaluation. The mapper fallback (this fix) makes distribution
  preview generation work going forward for it too, since
  `evaluationToLegacyDraft` re-derives the draft's `projectType` from the
  same stored classification section each time it's called — no
  re-evaluation needed.

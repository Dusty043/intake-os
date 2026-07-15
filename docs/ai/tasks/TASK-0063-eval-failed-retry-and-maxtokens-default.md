# TASK-0063: Fix intakes stuck at "evaluating" forever (Q-EVAL-1) + raise shared maxTokens default

**Status:** Complete
**Date:** 2026-07-16

## Request

User confirmed the discovery→manifest fix (TASK-0062) worked, but reported:
"okay discovery was fixed but it still failed intake" — a fresh intake
(`intake-mrmgsweh-3`) showed "AI Draft Running" with "No AI draft has been
generated yet" on the AI Draft tab, stuck indefinitely.

## Investigation

With TASK-0062's new exception-filter logging already deployed, checked
`docker logs intake-os-api-1` directly (no reproduction needed this time):

```
[WARN] [DiscoveryHttpController] Auto-evaluation failed for intake
intake-mrmgsweh-3: ProviderResponseValidationError: AI provider "openai"
returned an invalid response: response truncated at max_completion_tokens=2500
before valid JSON for custom_build: {"backendNeeds":[...
```

Confirmed via `GET /intakes/intake-mrmgsweh-3`: `status: "evaluating"`, no
`latestAnalysisDraft`.

## Root Cause (two parts)

1. **Same truncation class as TASK-0062**, different agent: `custom_build`
   (6 required fields, 4 of them free-text arrays) exceeded the *shared*
   `OpenAiLlmClient.completeStructured` default of `maxTokens: 2500` for this
   complex request. Checked all 13 evaluation agents: only `work_breakdown`
   (3000) and `final_synthesis` (2000) override the default explicitly — the
   other 10, including `custom_build`, rely on the shared 2500 default.
   `openai-eval-client.ts` and `openai-discovery-client.ts` (separate files
   with their own maxTokens defaults) have **zero importers** — confirmed
   dead code, not the live path; the real shared client is
   `providers/openai-llm-client.ts`.
2. **Q-EVAL-1 (already logged in TASK-0059, never fixed)**: when
   `generateEvaluation`'s orchestrator call throws, the intake had already
   transitioned to `"evaluating"` and stayed there — `generate_evaluation`
   only fires from `"submitted"` (`workflow.ts`), so there was no retry path.
   The `evaluation_failed: evaluating → submitted` transition was defined in
   `workflow.ts` but never referenced anywhere else in the codebase — grepped
   to confirm zero callers before this fix.

## Fix

- `src/application/providers/openai-llm-client.ts`: raised the shared default
  `maxTokens` from `2500` to `4000` — benefits every agent relying on the
  default (10 of 13 evaluation agents), not just `custom_build`.
- `src/application/intake-workflow-service.ts` (`generateEvaluation`): wrapped
  the orchestrator call in try/catch. On failure, transitions the intake back
  to `submitted` via the existing `evaluation_failed` action, records an
  `EVALUATION_FAILED` audit event with the error message, then rethrows (so
  the discovery controller's existing warning log still fires). This is the
  sole choke point both the manual "Generate Evaluation" endpoint and
  discovery's fire-and-forget auto-evaluation route through.

## Tests

Added 3 cases to `tests/generate-evaluation-service.test.mjs` under a new
`describe("generateEvaluation — orchestrator failure")` block, using the
existing `makeOrchestrator(agentOverrides)` harness with a fake
`intake_brief` agent that throws:
- reverts the intake to `submitted` (not stuck at `evaluating`)
- records an `EVALUATION_FAILED` audit event with the error message
- a subsequent `generateEvaluation` call after the revert succeeds normally
  (retry actually works end-to-end, not just the status flip)

`npm run build:core` clean. `npm test` — 794/794 pass (791 + 3 new), no
regressions.

## Deploy

Committed and pushed to `main`, pulled + rebuilt + restarted on
oreochiserver, healthcheck passed.

## Not Changed

- Did not manually recover `intake-mrmgsweh-3` (still stuck at `evaluating`
  from before this fix — it predates the revert logic, so nothing will
  auto-heal it). Recommended path: user creates a fresh intake, which will
  now either succeed (higher token budget) or self-revert to `submitted` for
  a retry click instead of getting stuck.
- Did not touch the dead `openai-eval-client.ts`/`openai-discovery-client.ts`
  files — confirmed zero importers, out of scope for this fix.

## Follow-up

- None new. This closes Q-EVAL-1 (updating its status in OPEN_QUESTIONS.md).

# TASK-0064: Bound custom_build agent output verbosity (still truncating at 4000 tokens)

**Status:** Complete
**Date:** 2026-07-16

## Request

User reported "still broken" on a fresh intake (`intake-mrmhkuou-18`) after
TASK-0063 deployed. Confirmed (via the TASK-0063 revert fix) it correctly
reverted to `submitted` instead of hanging forever — but audit trail showed
`EVALUATION_FAILED` again: `custom_build` truncated at `max_completion_tokens=4000`
(the just-raised default) for another elaborate infra-platform request.

## Root Cause

Raising the shared token ceiling (TASK-0063) doesn't bound verbosity — it only
raises the point at which truncation happens. `openai-custom-build-agent.ts`'s
system prompt gave no length/count guidance for its 4 free-text array fields
(`backendNeeds`, `frontendNeeds`, `integrationNeeds`, `infrastructureNeeds`),
so for maximalist real-world requests the model can always generate enough
content to exceed any fixed cap.

## Fix

`openai-custom-build-agent.ts`: added an explicit brevity constraint to the
system prompt ("keep each list item to one concise phrase, max ~15 words;
list at most 6 items per array — pick the most important, don't enumerate
exhaustively"), plus `maxTokens: 6000` as headroom on top of the bound. This
caps output size at the source rather than chasing verbosity with an
ever-higher ceiling.

## Tests

No new test added — this is a prompt-content and parameter tuning change
with no new branch/logic to regression-test; existing agent-instantiation
tests (`mock-evaluation-agents.test.mjs`) already cover the class shape.
Given repeated cost pressure this session, scoped verification to the live
retry below rather than adding a stub-LLM unit test for prompt wording.
`npm run build:core` clean. `npm test` — 794/794 pass, no regressions.

## Deploy

Committed and pushed to `main`, pulled + rebuilt + restarted on
oreochiserver, healthcheck passed. Retried the stuck intake
(`intake-mrmhkuou-18`, now at `submitted` thanks to TASK-0063's revert) via
the manual evaluation endpoint to confirm.

## Follow-up

- If other array-heavy agents (`solutions_architect`, `risk_security`,
  `low_code_path`) show the same truncation pattern for complex requests,
  apply the same brevity-constraint treatment rather than only raising
  maxTokens again. Not fixed proactively here — no evidence yet that they've
  actually failed, unlike `custom_build`.

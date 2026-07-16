# TASK-0073 — Enable live OpenAI provider in local .env

**Date**: 2026-07-17

## Context

Local `.env` had `AI_PROVIDER=mock` with `OPENAI_API_KEY` already populated but
`OPENAI_MODEL`/`OPENAI_TASKS_MODEL` blank. User asked to "rewire proper ai" —
confirmed via clarifying question this meant switching the pipeline from mock
agents to live OpenAI calls.

## Change

`.env` (gitignored, not committed):
- `AI_PROVIDER=mock` → `AI_PROVIDER=openai`
- `OPENAI_MODEL=` → `OPENAI_MODEL=gpt-5.6-sol` (higher-capability tier)
- `OPENAI_TASKS_MODEL=` (new) → `gpt-5.6-terra` (lower-cost tier)

These model names match the existing hardcoded fallback defaults in
[analysis-provider-config.ts](../../../src/application/providers/analysis-provider-config.ts:65-66),
so behavior is unchanged from the implicit default — this just makes the
config explicit and flips the provider switch.

No code changed. `analysis-provider-config.ts` already validates
`AI_PROVIDER=openai` requires `OPENAI_API_KEY` (present) and no other
config changes were needed.

## Verification

Not runtime-tested in this session — no server was started. Config parsing
logic (`loadAnalysisProviderConfig`) was read to confirm the new values are
accepted and match expected shape; no test suite run since no code changed.

## Follow-ups

- Start the API and run a real intake through Discovery to confirm live
  OpenAI calls succeed end-to-end (was mock-only before).
- Confirm cost tracking per docs/product/ai-cost-governance.md picks up
  usage now that a real provider is active.

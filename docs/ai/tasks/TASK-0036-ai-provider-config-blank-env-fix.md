# TASK-0036 — AI Provider Config: Blank Env Var Fix + Dev/Prod Model Defaults

## Status: Complete

## Objective

Continue the provider-agnostic AI layer from TASK-0015: fix a startup bug discovered while wiring dev to OpenAI and Bedrock to production, and confirm/document default models per provider.

## Problem Found

`loadAnalysisProviderConfig()` (`src/application/providers/analysis-provider-config.ts`) used `env["AI_PROVIDER"] ?? "mock"`. The `??` operator only falls back on `null`/`undefined`, not on an empty string. The local `.env` had `AI_PROVIDER=` (present but blank) — a state produced by scaffolding the var without filling it in. This made `providerRaw` resolve to `""`, which is not in `SUPPORTED_PROVIDERS`, so the app threw `ConfigurationError: AI_PROVIDER="" is not supported` at startup instead of defaulting to mock as intended.

The same blank-vs-unset gap existed for `OPENAI_MODEL`, `OPENAI_TASKS_MODEL`, `ANTHROPIC_MODEL`, `AWS_REGION`, `BEDROCK_MODEL_ID`, `BEDROCK_PREMIUM_MODEL_ID`, and `BEDROCK_PROVIDER_MODE`.

`.env` also still had two dead vars (`AI_LAYER_ENABLED`, `AWS_BEDROCK_MODEL_ID`) left over from before TASK-0015 — neither is read anywhere in the code (current schema uses `AI_PROVIDER` / `BEDROCK_MODEL_ID`).

## What Changed

- `src/application/providers/analysis-provider-config.ts` — added `nonEmpty()` helper that treats unset, `""`, and whitespace-only env values as absent. Applied to `AI_PROVIDER` and all per-provider model/region fields. This does **not** change the TASK-0015 "no silent fallback" rule: an explicitly-set real provider (e.g. `AI_PROVIDER=openai`) still throws `ConfigurationError` if its required key is missing — only the *unset-vs-blank* ambiguity for defaulting to mock was fixed.
- OpenAI default model changed from `gpt-4o-mini` to `gpt-5.5` (in both `analysis-provider-config.ts` and `llm-client-factory.ts`'s `resolveModel()`), since intake analysis runs the full draft generation in one call (classification + drafting + synthesis-adjacent reasoning) — per `docs/product/ai-cost-governance.md`'s tiering principle, this warrants the higher-capability model, not the cheapest one. `OPENAI_TASKS_MODEL` remains available as an override for a lighter-weight task split.
- `model-cost-registry.ts` — added confirmed pricing for `gpt-5.5` ($5.00/$30.00 per 1M input/output), `gpt-5.4-mini` ($0.75/$4.50), and `gpt-5.4-nano` ($0.20/$1.25), per developers.openai.com/api/docs/models/compare (checked 2026-07-01). `gpt-5.4-nano` is documented in `.env.example` as the cost-fallback option for `OPENAI_TASKS_MODEL` if `gpt-5.4-mini` spend runs too high — no automatic cost-triggered downgrade logic was built; switching models is still a manual env-var change. Cached-input pricing isn't tracked (registry only models input/output).
- Bedrock model IDs remain required with no hardcoded default — Bedrock model ARNs/IDs are account- and region-specific, so guessing one would be unsafe. `.env.example` already documents recommended values (`anthropic.claude-haiku-4-5` / `anthropic.claude-sonnet-4-5`); these should be re-verified against the AWS Bedrock console before first live use, since model availability changes over time.
- `.env` — removed the two dead vars, clarified that dev uses `openai` once `OPENAI_API_KEY` is filled in, kept `AI_PROVIDER=mock` as the safe local default until a real key is added (no fabricated key was added).
- `.env.example` — clarified that dev should use `openai` and Bedrock is preferred for staging/production; noted blank values now fall back to defaults instead of needing to be deleted.
- `tests/analysis-provider-config.test.mjs` — updated the default-model assertion to `gpt-4o`; added coverage for blank `AI_PROVIDER`, blank `OPENAI_MODEL`/`OPENAI_TASKS_MODEL`, and blank `BEDROCK_MODEL_ID`.

## Tests

```
npm run build:core   — pass
npm run typecheck    — pass
node --test tests/analysis-provider-config.test.mjs  — 15/15 pass
npm test              — 683/688 pass; 5 pre-existing failures in tests/discovery-phase-3.test.mjs
                        (workflow status default 'draft' vs 'submitted'), unrelated to this change —
                        not modified, not touched by these files.
```

## Follow-up / Open Items

- Re-verify the Bedrock Claude model IDs in `.env.example` against the current AWS Bedrock console before first live provisioning (model naming changes over time; do not assume the documented IDs are still current).
- Q-COST-1 (`docs/ai/OPEN_QUESTIONS.md`) is still open — this task fixed config-loading correctness and set dev/prod defaults, but did not implement per-agent model tiering (lower-cost vs higher-capability split) called for in `docs/product/ai-cost-governance.md`. The analysis pipeline still runs as a single uniform-model call.

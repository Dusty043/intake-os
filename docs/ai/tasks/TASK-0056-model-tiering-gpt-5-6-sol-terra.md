# TASK-0056 — Model update: gpt-5.6-sol (higher) / gpt-5.6-terra (lesser)

## Request

"lets update the models use gpt-5.6-sol for higher tasks gpt-5.6-terra for
lesser" — switch the OpenAI models used, with two explicit tiers.

## Context Read

- `docs/product/ai-cost-governance.md` — "Model Tiering" section already
  specifies this exact two-tier principle (lower-cost for
  summarization/classification/clarification/extraction, higher-capability
  for architecture/planning/trade-offs/risk/synthesis) and a full
  "Recommended Model Tier by Agent" table naming every Evaluation agent.
- `docs/ai/tasks/TASK-0036-ai-provider-config-blank-env-fix.md` — the prior
  decision that bumped the single-call intake analysis pipeline to the
  higher tier ("gpt-4o-mini" → "gpt-5.5") because it does classification +
  drafting + synthesis-adjacent reasoning in one call. This decision must
  survive the change (that pipeline still needs the higher tier).

## Finding: tiering was speced but never actually wired up

`resolveModel(config)` was the *only* model resolver in the codebase — every
Evaluation agent (`createAllEvaluationAgents`) and every real Discovery
agent (`discovery.module.ts`) received the exact same single model string,
despite `ai-cost-governance.md`'s table naming a distinct tier per agent.
`OPENAI_TASKS_MODEL` existed but acted as a **full override** of `model`
itself when set (`nonEmpty(env["OPENAI_TASKS_MODEL"]) ?? nonEmpty(env["OPENAI_MODEL"]) ?? "gpt-5.5"`)
— not a second, independently-resolved tier. That's also a latent bug: if
someone set `OPENAI_TASKS_MODEL` expecting it to apply only to "lighter
tasks", it would have silently downgraded the single-call intake analysis
pipeline too (which reads `config.openai.model` directly and, per TASK-0036,
deliberately needs the higher tier).

## Changes

### Config (`analysis-provider-config.ts`, `llm-client-factory.ts`)

- `AnalysisProviderConfig.openai` gained a `tasksModel` field alongside
  `model`. Each resolves from its **own** env var only —
  `model = OPENAI_MODEL ?? "gpt-5.6-sol"`,
  `tasksModel = OPENAI_TASKS_MODEL ?? "gpt-5.6-terra"` — fixing the
  override-bleed bug above.
- Added `resolveTasksModel(config)` alongside the existing `resolveModel(config)`.
  Non-OpenAI providers (Anthropic, Bedrock) have no distinct tasks tier yet
  — `resolveTasksModel` falls back to `resolveModel` for them.
- `resolveModel`'s hardcoded fallback default also moved from `"gpt-5.5"` to
  `"gpt-5.6-sol"`.

### Per-agent routing (`discovery.module.ts`, `agents/openai/index.ts`, `runtime.module.ts`)

Routed each agent to its tier per `ai-cost-governance.md`'s table:

| Higher tier (`model` / gpt-5.6-sol) | Lower tier (`tasksModel` / gpt-5.6-terra) |
|---|---|
| Solutions Architect, Custom Build, Risk/Security, Cost/Effort, Work Breakdown, Final Synthesis, Critic/QA (Evaluation) | Intake Analyst, Clarification Questions, Project Classifier, Low-Code Path, Distribution Planner (Evaluation) |
| Solution Generation, Proposal Composition (Discovery) | Intent Extraction, Problem Framing, Clarification (Discovery) |
| Single-call intake analysis pipeline (unchanged, per TASK-0036) | — |

`createAllEvaluationAgents(client, model)` → `createAllEvaluationAgents(client, model, tasksModel)`
— its one call site (`runtime.module.ts`) updated. Discovery's `buildOrchestrator`
in `discovery.module.ts` now resolves both `model` and `tasksModel` and passes
the right one to each of the 5 real agent constructors. (Discovery's mock
manifest generator has no real/OpenAI counterpart today — pre-existing gap,
unrelated to this task, not touched.)

### Not touched

- `model-cost-registry.ts` — did **not** add entries for `gpt-5.6-sol`/`gpt-5.6-terra`.
  I don't have real per-1M-token pricing for these models and won't fabricate
  numbers for a cost-tracking feature. Falls back to `null` cost automatically
  (existing behavior for any unregistered model) until real pricing is added
  there or via `COST_INPUT_GPT_5_6_SOL`/`COST_OUTPUT_GPT_5_6_SOL` (and `_TERRA`)
  env vars. Logged as **Q-COST-3** in `docs/ai/OPEN_QUESTIONS.md`.
- The live server's `.env.server` — reading/editing production config needs
  explicit authorization; asked the user separately rather than doing it
  unprompted.

## Testing

- `npx tsc --noEmit` (core + apps/api + apps/web) — clean.
- `npm test` — 772/774; same 2 pre-existing unrelated failures as prior
  sessions (flaky network-dependent auth test, untracked in-progress
  `monday-config` test).
- Updated `tests/analysis-provider-config.test.mjs`: the 3 tests asserting
  the old default (`gpt-5.5`) and the old override-bleed behavior
  ("OPENAI_TASKS_MODEL overrides OPENAI_MODEL") now assert the new default
  and confirm each tier resolves independently.
- No per-agent-routing test added — routing correctness (which agent gets
  which tier) was verified by reading the updated call sites, not by an
  automated test asserting e.g. "OpenAIRiskSecurityAgent receives the higher
  model." Worth adding if this routing changes again.

## Follow-up

- Q-COST-3 (real pricing for the two new models) — open.
- Live server `.env.server` not yet updated — pending explicit go-ahead.

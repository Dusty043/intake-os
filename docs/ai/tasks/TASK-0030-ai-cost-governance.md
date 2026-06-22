# TASK-0030 — AI Cost Governance

**Status:** COMPLETE  
**Priority:** HIGH — prevents runaway spend once real evaluations start  
**Estimated effort:** 3–4 hours  
**Blocked on:** nothing  
**Product spec:** `docs/product/ai-cost-governance.md`

---

## Current State

The `AgentRun` Prisma model already has the right columns:

```prisma
model AgentRun {
  inputTokens      Int?
  outputTokens     Int?
  totalTokens      Int?
  estimatedCostUsd Decimal?
  latencyMs        Int?
  status           String
  errorMessage     String?
  ...
}
```

And `src/application/providers/token-cost.ts` already has:

```typescript
export function estimateCost(inputTokens, outputTokens, config): number | null
export function parseOptionalFloat(value): number | null
```

The gap: these pieces exist but are not connected. Token counts from OpenAI/Anthropic responses are not being persisted to `AgentRun`. `estimateCost()` is defined but never called during evaluation. There are no cost report endpoints. No spend alerts. No per-request cost visibility in the UI.

---

## Acceptance Criteria

- [ ] Every AI agent run that completes (success or failure) writes an `AgentRun` record with `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsd`, `latencyMs`, and `status`
- [ ] Failed AI calls also write an `AgentRun` record (with `status: "failed"`, `errorMessage`, and whatever token data is available)
- [ ] `estimatedCostUsd` is populated using the existing `estimateCost()` utility when provider returns token counts
- [ ] Model cost config is loaded from environment variables (not hardcoded)
- [ ] A `GET /admin/ai-usage` endpoint returns aggregated cost data: total cost, cost by model, cost by agent role, cost by intake
- [ ] The UI shows per-evaluation AI cost on the intake detail page (sum of all `AgentRun` costs for that evaluation)
- [ ] A `GET /admin/ai-usage/summary` endpoint returns monthly totals
- [ ] Regeneration count is tracked per evaluation (existing `AgentRun` records can be counted — no new column needed)
- [ ] All existing tests pass after changes (no regressions in evaluation/agent tests)

---

## What to Build

### Phase 1 — Wire token persistence in AI providers

The three AI provider adapters (`OpenAIIntakeAnalysisProvider`, `AnthropicIntakeAnalysisProvider`, `BedrockIntakeAnalysisProvider`) all call their respective SDKs and return structured output. After each call, they must persist an `AgentRun` record.

The adapter currently looks something like:

```typescript
// BEFORE
const response = await openai.chat.completions.create({ ... });
return parseResponse(response);
```

It needs to become:

```typescript
// AFTER
const startedAt = Date.now();
let status = "succeeded";
let errorMessage: string | undefined;
let inputTokens: number | undefined;
let outputTokens: number | undefined;
let totalTokens: number | undefined;
let result: AgentOutput;

try {
  const response = await openai.chat.completions.create({ ... });
  inputTokens = response.usage?.prompt_tokens;
  outputTokens = response.usage?.completion_tokens;
  totalTokens = response.usage?.total_tokens;
  result = parseResponse(response);
} catch (err) {
  status = "failed";
  errorMessage = String(err);
  throw err;
} finally {
  const latencyMs = Date.now() - startedAt;
  const costConfig = loadModelCostConfig(this.model);
  const estimatedCostUsd = inputTokens != null && outputTokens != null
    ? estimateCost(inputTokens, outputTokens, costConfig)
    : null;

  await agentRunRepository.save({
    evaluationId: context.evaluationId,
    sectionId: context.sectionId,
    agentRole: context.agentRole,
    provider: "openai",
    model: this.model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    latencyMs,
    status,
    errorMessage,
    startedAt: new Date(startedAt),
    completedAt: new Date(),
  });
}

return result;
```

The `finally` block ensures a record is always written, even on failure.

### Phase 2 — Model cost config

**New file:** `src/application/providers/model-cost-registry.ts`

```typescript
export interface ModelCostConfig {
  inputCostPer1MTokens: number | null;
  outputCostPer1MTokens: number | null;
}

// Costs loaded from env vars, with hardcoded fallbacks for known models.
// Env var format: COST_INPUT_<MODEL_SLUG>=X.XX
// Example: COST_INPUT_GPT_4O=5.00
export function loadModelCostConfig(model: string): ModelCostConfig {
  const slug = model.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const inputEnv = process.env[`COST_INPUT_${slug}`];
  const outputEnv = process.env[`COST_OUTPUT_${slug}`];

  if (inputEnv && outputEnv) {
    return {
      inputCostPer1MTokens: parseOptionalFloat(inputEnv),
      outputCostPer1MTokens: parseOptionalFloat(outputEnv),
    };
  }

  // Known model defaults (USD per 1M tokens, approximate)
  const defaults: Record<string, ModelCostConfig> = {
    "gpt-4o": { inputCostPer1MTokens: 2.50, outputCostPer1MTokens: 10.00 },
    "gpt-4o-mini": { inputCostPer1MTokens: 0.15, outputCostPer1MTokens: 0.60 },
    "claude-sonnet-4-6": { inputCostPer1MTokens: 3.00, outputCostPer1MTokens: 15.00 },
    "claude-haiku-4-5-20251001": { inputCostPer1MTokens: 0.80, outputCostPer1MTokens: 4.00 },
  };

  return defaults[model] ?? { inputCostPer1MTokens: null, outputCostPer1MTokens: null };
}
```

Label all cost estimates as estimates — not exact billing data.

### Phase 3 — Cost read endpoints

**New controller:** `apps/api/src/modules/admin/ai-usage.controller.ts`

```
GET /admin/ai-usage?intakeId=&startDate=&endDate=
GET /admin/ai-usage/summary?month=2026-06
```

`GET /admin/ai-usage`:
- Returns all `AgentRun` records matching optional filters
- Groups by: model, agentRole, intake, evaluation
- Returns: `{ runs: [...], totalCostUsd: number, totalTokens: number, runCount: number }`

`GET /admin/ai-usage/summary`:
- Aggregates `AgentRun.estimatedCostUsd` for the given month
- Groups by model and agentRole
- Returns totals per group + grand total

Both endpoints require `admin` or `devops_lead` role.

### Phase 4 — Per-evaluation cost in UI

On the intake detail page (`apps/web/src/app/intakes/[id]/page.tsx`), add a cost badge to the evaluation section:

```
AI Cost: ~$0.42  (estimated)  [3 agent runs]
```

Source: sum of all `AgentRun.estimatedCostUsd` for the evaluation. If all costs are null (model costs not configured), show "cost unknown".

### Phase 5 — Regeneration count visibility

The number of regenerations per evaluation is already derivable: count `AgentRun` records where `agentRole` matches the section being regenerated and `evaluationId` matches. No new column needed.

In the UI, next to each evaluation section's regenerate button, show:

```
[↺ Regenerate]   (3 of 5 regenerations used)
```

This uses the existing `regen_limit` from `docs/product/ai-cost-governance.md` (default 5 per section).

---

## Environment Variables

```bash
# Model cost overrides (optional — defaults used if not set)
COST_INPUT_GPT_4O=2.50
COST_OUTPUT_GPT_4O=10.00
COST_INPUT_GPT_4O_MINI=0.15
COST_OUTPUT_GPT_4O_MINI=0.60
COST_INPUT_CLAUDE_SONNET_4_6=3.00
COST_OUTPUT_CLAUDE_SONNET_4_6=15.00

# Regeneration limits (optional)
AI_MAX_FULL_REGEN=3
AI_MAX_SECTION_REGEN=5
```

---

## Files to Create / Change

| File | Change |
|---|---|
| `src/application/providers/model-cost-registry.ts` | NEW — model cost config loader |
| `src/application/providers/openai-intake-analysis-provider.ts` | ADD token persistence in finally block |
| `src/application/providers/anthropic-intake-analysis-provider.ts` | ADD token persistence in finally block |
| `src/application/providers/bedrock-intake-analysis-provider.ts` | ADD token persistence in finally block |
| `apps/api/src/modules/admin/ai-usage.controller.ts` | NEW — cost read endpoints |
| `apps/web/src/app/intakes/[id]/page.tsx` | ADD per-evaluation cost badge |
| `apps/web/src/app/admin/ai-usage/page.tsx` | NEW — admin cost dashboard |
| `tests/ai-cost-governance.test.mjs` | NEW — unit tests |

---

## Tests Required

```
tests/ai-cost-governance.test.mjs
```

| Test | Description |
|---|---|
| AgentRun written on successful call | Mock provider → AgentRun record created with tokens |
| AgentRun written on failed call | Forced error → AgentRun with status "failed" |
| estimatedCostUsd populated when tokens available | Known model + known tokens → correct cost |
| estimatedCostUsd null when tokens unavailable | No usage in response → null, not 0 |
| estimatedCostUsd null when model not in registry | Unknown model, no env var → null |
| env var overrides default cost | COST_INPUT_GPT_4O=99.00 → used over default |
| monthly summary sums correctly | 3 runs with costs → correct total |

---

## What NOT to Change

- Do not change the `AgentRun` Prisma schema — it already has all the needed columns.
- Do not add hard limits that block evaluations in this task — governance controls (spending alerts, full-regen limits) are a follow-up. This task is about making cost data visible.
- Do not modify any approval, provisioning, or state machine logic.

---

## Open Questions

| ID | Question | Owner |
|---|---|---|
| Q-COST-1 | Which AI models are currently being used in production evaluations? | Engineering |
| Q-COST-2 | Should cost estimates be shown to non-admin users (intake owners), or admin-only? | Product |
| Q-COST-3 | Should a spend alert notification fire to Google Chat when monthly cost exceeds a threshold? | Product |

---

## Handoff

The schema is already done. The cost calculator already exists at `src/application/providers/token-cost.ts`. This task is primarily about wiring: call `estimateCost()` after every AI provider call, save the result in the `AgentRun` record, and expose a read endpoint. The model cost registry is the only genuinely new piece. The UI changes are additive (badge + admin page).

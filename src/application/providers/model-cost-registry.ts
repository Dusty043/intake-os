import { parseOptionalFloat } from "./token-cost.js";
import type { TokenCostConfig } from "./token-cost.js";

// ---------------------------------------------------------------------------
// Model cost registry
// ---------------------------------------------------------------------------
//
// Returns cost config for a model. Env vars take precedence over built-in
// defaults. Format: COST_INPUT_<SLUG>=X.XX  COST_OUTPUT_<SLUG>=X.XX
// where SLUG is the model name upper-cased with non-alphanumeric chars → "_".
//
// Example: model "gpt-4o" → COST_INPUT_GPT_4O and COST_OUTPUT_GPT_4O
//
// These are estimates — not exact billing data. Actual billing may differ.

const KNOWN_MODEL_COSTS: Record<string, TokenCostConfig> = {
  "gpt-4o":                       { inputCostPer1MTokens: 2.50,  outputCostPer1MTokens: 10.00 },
  "gpt-4o-mini":                  { inputCostPer1MTokens: 0.15,  outputCostPer1MTokens: 0.60  },
  "gpt-4-turbo":                  { inputCostPer1MTokens: 10.00, outputCostPer1MTokens: 30.00 },
  "claude-sonnet-4-6":            { inputCostPer1MTokens: 3.00,  outputCostPer1MTokens: 15.00 },
  "claude-haiku-4-5-20251001":    { inputCostPer1MTokens: 0.80,  outputCostPer1MTokens: 4.00  },
  "claude-opus-4-8":              { inputCostPer1MTokens: 15.00, outputCostPer1MTokens: 75.00 },
  "claude-3-5-haiku-latest":      { inputCostPer1MTokens: 0.80,  outputCostPer1MTokens: 4.00  },
  "claude-3-5-sonnet-latest":     { inputCostPer1MTokens: 3.00,  outputCostPer1MTokens: 15.00 },
};

export function loadModelCostConfig(model: string): TokenCostConfig {
  const slug = model.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const inputEnv = process.env[`COST_INPUT_${slug}`];
  const outputEnv = process.env[`COST_OUTPUT_${slug}`];

  if (inputEnv !== undefined && outputEnv !== undefined) {
    return {
      inputCostPer1MTokens: parseOptionalFloat(inputEnv),
      outputCostPer1MTokens: parseOptionalFloat(outputEnv),
    };
  }

  return KNOWN_MODEL_COSTS[model] ?? { inputCostPer1MTokens: null, outputCostPer1MTokens: null };
}

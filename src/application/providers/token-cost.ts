export interface TokenCostConfig {
  inputCostPer1MTokens?: number | null;
  outputCostPer1MTokens?: number | null;
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  config: TokenCostConfig,
): number | null {
  if (config.inputCostPer1MTokens == null || config.outputCostPer1MTokens == null) {
    return null;
  }
  const inputCost = (inputTokens / 1_000_000) * config.inputCostPer1MTokens;
  const outputCost = (outputTokens / 1_000_000) * config.outputCostPer1MTokens;
  return Number((inputCost + outputCost).toFixed(6));
}

export function parseOptionalFloat(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

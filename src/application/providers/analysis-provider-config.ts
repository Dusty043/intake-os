import { ConfigurationError } from "../errors.js";
import type { AnalysisProviderName } from "../intake-analysis-provider.js";
import { parseOptionalFloat } from "./token-cost.js";

export interface AnalysisProviderConfig {
  provider: AnalysisProviderName;
  maxOutputTokens: number;
  temperature: number;

  openai?: {
    apiKey: string;
    model: string;
    inputCostPer1MTokens: number | null;
    outputCostPer1MTokens: number | null;
  };

  anthropic?: {
    apiKey: string;
    model: string;
    inputCostPer1MTokens: number | null;
    outputCostPer1MTokens: number | null;
  };

  bedrock?: {
    region: string;
    modelId: string;
    premiumModelId?: string;
    providerMode: string;
    inputCostPer1MTokens: number | null;
    outputCostPer1MTokens: number | null;
  };
}

const SUPPORTED_PROVIDERS: AnalysisProviderName[] = ["mock", "openai", "anthropic", "bedrock"];

export function loadAnalysisProviderConfig(env: NodeJS.ProcessEnv = process.env): AnalysisProviderConfig {
  const providerRaw = (nonEmpty(env["AI_PROVIDER"]) ?? "mock").toLowerCase().trim();

  if (!SUPPORTED_PROVIDERS.includes(providerRaw as AnalysisProviderName)) {
    throw new ConfigurationError(
      `AI_PROVIDER="${providerRaw}" is not supported. Valid values: ${SUPPORTED_PROVIDERS.join(", ")}.`,
    );
  }

  const provider = providerRaw as AnalysisProviderName;

  const config: AnalysisProviderConfig = {
    provider,
    maxOutputTokens: parseInt(env["AI_MAX_OUTPUT_TOKENS"] ?? "2500", 10),
    temperature: parseFloat(env["AI_TEMPERATURE"] ?? "0.2"),
  };

  if (provider === "openai") {
    const apiKey = env["OPENAI_API_KEY"] ?? "";
    if (!apiKey) throw new ConfigurationError("AI_PROVIDER=openai requires OPENAI_API_KEY.");
    config.openai = {
      apiKey,
      model: nonEmpty(env["OPENAI_TASKS_MODEL"]) ?? nonEmpty(env["OPENAI_MODEL"]) ?? "gpt-5.5",
      inputCostPer1MTokens: parseOptionalFloat(env["OPENAI_INPUT_COST_PER_1M_TOKENS"]),
      outputCostPer1MTokens: parseOptionalFloat(env["OPENAI_OUTPUT_COST_PER_1M_TOKENS"]),
    };
  }

  if (provider === "anthropic") {
    const apiKey = env["ANTHROPIC_API_KEY"] ?? "";
    if (!apiKey) throw new ConfigurationError("AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY.");
    config.anthropic = {
      apiKey,
      model: nonEmpty(env["ANTHROPIC_MODEL"]) ?? "claude-3-5-haiku-latest",
      inputCostPer1MTokens: parseOptionalFloat(env["ANTHROPIC_INPUT_COST_PER_1M_TOKENS"]),
      outputCostPer1MTokens: parseOptionalFloat(env["ANTHROPIC_OUTPUT_COST_PER_1M_TOKENS"]),
    };
  }

  if (provider === "bedrock") {
    const modelId = nonEmpty(env["BEDROCK_MODEL_ID"]);
    if (!modelId) throw new ConfigurationError("AI_PROVIDER=bedrock requires BEDROCK_MODEL_ID.");
    config.bedrock = {
      region: nonEmpty(env["AWS_REGION"]) ?? "us-east-1",
      modelId,
      premiumModelId: nonEmpty(env["BEDROCK_PREMIUM_MODEL_ID"]),
      providerMode: nonEmpty(env["BEDROCK_PROVIDER_MODE"]) ?? "converse",
      inputCostPer1MTokens: parseOptionalFloat(env["BEDROCK_INPUT_COST_PER_1M_TOKENS"]),
      outputCostPer1MTokens: parseOptionalFloat(env["BEDROCK_OUTPUT_COST_PER_1M_TOKENS"]),
    };
  }

  return config;
}

/** Treats unset, empty, and whitespace-only env values as absent so blank `.env` entries fall back to defaults instead of being used literally. */
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

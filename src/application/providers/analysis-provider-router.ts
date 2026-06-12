import { ConfigurationError } from "../errors.js";
import type { AnalysisProviderName, AnalysisProviderOptions, AnalysisProviderResult, IntakeAnalysisProvider } from "../intake-analysis-provider.js";
import type { ProjectIntakeRecord } from "../types.js";
import type { AnalysisProviderConfig } from "./analysis-provider-config.js";
import { AnthropicIntakeAnalysisProvider } from "./anthropic-intake-analysis-provider.js";
import { BedrockIntakeAnalysisProvider } from "./bedrock-intake-analysis-provider.js";
import { MockIntakeAnalysisProvider } from "./mock-intake-analysis-provider.js";
import { OpenAIIntakeAnalysisProvider } from "./openai-intake-analysis-provider.js";

export class AnalysisProviderRouter implements IntakeAnalysisProvider {
  readonly name: AnalysisProviderName;
  private readonly provider: IntakeAnalysisProvider;

  constructor(config: AnalysisProviderConfig) {
    this.provider = buildProvider(config);
    this.name = this.provider.name;
  }

  generateDraft(
    intake: ProjectIntakeRecord,
    options: AnalysisProviderOptions,
  ): Promise<AnalysisProviderResult> {
    return this.provider.generateDraft(intake, options);
  }
}

function buildProvider(config: AnalysisProviderConfig): IntakeAnalysisProvider {
  switch (config.provider) {
    case "mock":
      return new MockIntakeAnalysisProvider();

    case "openai": {
      if (!config.openai) {
        throw new ConfigurationError("AI_PROVIDER=openai but OpenAI config is missing.");
      }
      return new OpenAIIntakeAnalysisProvider({
        apiKey: config.openai.apiKey,
        model: config.openai.model,
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
        inputCostPer1MTokens: config.openai.inputCostPer1MTokens,
        outputCostPer1MTokens: config.openai.outputCostPer1MTokens,
      });
    }

    case "anthropic": {
      if (!config.anthropic) {
        throw new ConfigurationError("AI_PROVIDER=anthropic but Anthropic config is missing.");
      }
      return new AnthropicIntakeAnalysisProvider({
        apiKey: config.anthropic.apiKey,
        model: config.anthropic.model,
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
        inputCostPer1MTokens: config.anthropic.inputCostPer1MTokens,
        outputCostPer1MTokens: config.anthropic.outputCostPer1MTokens,
      });
    }

    case "bedrock": {
      if (!config.bedrock) {
        throw new ConfigurationError("AI_PROVIDER=bedrock but Bedrock config is missing.");
      }
      return new BedrockIntakeAnalysisProvider({
        region: config.bedrock.region,
        modelId: config.bedrock.modelId,
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
        inputCostPer1MTokens: config.bedrock.inputCostPer1MTokens,
        outputCostPer1MTokens: config.bedrock.outputCostPer1MTokens,
      });
    }

    default:
      throw new ConfigurationError(`Unknown AI provider: ${String(config.provider)}`);
  }
}

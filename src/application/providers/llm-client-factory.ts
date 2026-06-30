import { ConfigurationError } from "../errors.js";
import type { LlmClient } from "../llm-client.js";
import type { AnalysisProviderConfig } from "./analysis-provider-config.js";
import { OpenAiLlmClient } from "./openai-llm-client.js";
import { AnthropicLlmClient } from "./anthropic-llm-client.js";
import { BedrockLlmClient } from "./bedrock-llm-client.js";

export function createLlmClient(config: AnalysisProviderConfig): LlmClient {
  switch (config.provider) {
    case "openai": {
      if (!config.openai) throw new ConfigurationError("OpenAI config missing — ensure OPENAI_API_KEY is set.");
      return new OpenAiLlmClient(config.openai.apiKey);
    }
    case "anthropic": {
      if (!config.anthropic) throw new ConfigurationError("Anthropic config missing — ensure ANTHROPIC_API_KEY is set.");
      return new AnthropicLlmClient(config.anthropic.apiKey);
    }
    case "bedrock": {
      if (!config.bedrock) throw new ConfigurationError("Bedrock config missing — ensure BEDROCK_MODEL_ID is set.");
      return new BedrockLlmClient(config.bedrock.region);
    }
    case "mock":
      // Mock mode uses pre-built mock agents that bypass LlmClient entirely.
      // This placeholder satisfies the type but should never be called.
      return {
        provider: "mock",
        completeStructured(): Promise<never> {
          return Promise.reject(new Error("MockLlmClient.completeStructured should not be called — use mock agents instead."));
        },
      };
  }
}

/** Extract the configured model name from any provider config. */
export function resolveModel(config: AnalysisProviderConfig): string {
  return config.openai?.model ?? config.anthropic?.model ?? config.bedrock?.modelId ?? "gpt-4o-mini";
}

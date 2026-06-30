export interface StructuredCompletionParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface StructuredCompletionResult<T = unknown> {
  content: T;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

export type LlmProviderName = "openai" | "anthropic" | "bedrock" | "mock";

export interface LlmClient {
  readonly provider: LlmProviderName;
  completeStructured<T>(params: StructuredCompletionParams): Promise<StructuredCompletionResult<T>>;
}

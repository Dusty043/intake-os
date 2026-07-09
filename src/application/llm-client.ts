export interface StructuredCompletionParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Called with each raw text fragment as it streams in, if the provider supports it. Optional — omit for no live progress. */
  onToken?: (text: string) => void;
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

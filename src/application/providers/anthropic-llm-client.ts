import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient, StructuredCompletionParams, StructuredCompletionResult } from "../llm-client.js";

export class AnthropicLlmClient implements LlmClient {
  readonly provider = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async completeStructured<T>(params: StructuredCompletionParams): Promise<StructuredCompletionResult<T>> {
    const { model, systemPrompt, userPrompt, schemaName, schema, maxTokens = 2500 } = params;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: [
        {
          name: schemaName,
          description: `Emit structured output for ${schemaName}.`,
          input_schema: schema as unknown as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: schemaName },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === schemaName,
    );

    if (!toolUse) {
      throw new Error(`Anthropic response missing tool_use block "${schemaName}"`);
    }

    return {
      content: toolUse.input as T,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      finishReason: response.stop_reason ?? "end_turn",
    };
  }
}

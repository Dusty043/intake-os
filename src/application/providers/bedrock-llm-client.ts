import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ToolInputSchema,
} from "@aws-sdk/client-bedrock-runtime";
import type { LlmClient, StructuredCompletionParams, StructuredCompletionResult } from "../llm-client.js";

export class BedrockLlmClient implements LlmClient {
  readonly provider = "bedrock" as const;
  private readonly client: BedrockRuntimeClient;

  constructor(region: string) {
    this.client = new BedrockRuntimeClient({ region });
  }

  async completeStructured<T>(params: StructuredCompletionParams): Promise<StructuredCompletionResult<T>> {
    const { model, systemPrompt, userPrompt, schemaName, schema, maxTokens = 2500 } = params;

    const response = await this.client.send(
      new ConverseCommand({
        modelId: model,
        system: [{ text: systemPrompt }],
        messages: [{ role: "user", content: [{ text: userPrompt }] }],
        inferenceConfig: { maxTokens },
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: schemaName,
                description: `Emit structured output for ${schemaName}.`,
                inputSchema: { json: schema as unknown } as ToolInputSchema,
              },
            },
          ],
          toolChoice: { tool: { name: schemaName } },
        },
      }),
    );

    const toolUseBlock = response.output?.message?.content?.find(
      (block) => block.toolUse?.name === schemaName,
    );

    if (!toolUseBlock?.toolUse?.input) {
      throw new Error(`Bedrock response missing tool_use block "${schemaName}"`);
    }

    return {
      content: toolUseBlock.toolUse.input as T,
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
      finishReason: response.stopReason ?? "end_turn",
    };
  }
}

import OpenAI from "openai";
import type { LlmClient, StructuredCompletionParams, StructuredCompletionResult } from "../llm-client.js";

export class OpenAiLlmClient implements LlmClient {
  readonly provider = "openai" as const;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async completeStructured<T>(params: StructuredCompletionParams): Promise<StructuredCompletionResult<T>> {
    const { model, systemPrompt, userPrompt, schemaName, schema, maxTokens = 2500 } = params;

    const response = await this.client.chat.completions.create({
      model,
      max_completion_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error(`OpenAI returned empty content for ${schemaName}`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`OpenAI returned non-JSON for ${schemaName}: ${raw.slice(0, 200)}`);
    }

    return {
      content: parsed as T,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      finishReason: response.choices[0]?.finish_reason ?? "unknown",
    };
  }
}

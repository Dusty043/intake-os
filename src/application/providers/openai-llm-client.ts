import OpenAI from "openai";
import type { LlmClient, StructuredCompletionParams, StructuredCompletionResult } from "../llm-client.js";
import { ProviderResponseValidationError } from "../errors.js";

export class OpenAiLlmClient implements LlmClient {
  readonly provider = "openai" as const;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async completeStructured<T>(params: StructuredCompletionParams): Promise<StructuredCompletionResult<T>> {
    // 10 of 13 evaluation agents and most discovery agents rely on this default
    // rather than passing their own maxTokens. 2500 was too tight for verbose,
    // multi-array schemas (e.g. custom_build) on complex real-world requests —
    // truncated mid-JSON, thrown as ProviderResponseValidationError.
    const { model, systemPrompt, userPrompt, schemaName, schema, maxTokens = 4000, onToken } = params;

    // Always streams internally — same final result (accumulated content is
    // parsed identically to a non-streaming call), but lets Discovery forward
    // live fragments via onToken while other callers simply don't pass it.
    const stream = await this.client.chat.completions.create({
      model,
      max_completion_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let raw = "";
    let finishReason = "unknown";
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        raw += delta;
        onToken?.(delta);
      }
      const reason = chunk.choices[0]?.finish_reason;
      if (reason) finishReason = reason;
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    if (!raw) throw new ProviderResponseValidationError("openai", `Empty content for ${schemaName}.`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // finish_reason "length" means the model hit max_completion_tokens before
      // closing the JSON — a distinguishable, actionable cause (raise maxTokens
      // for this schema) rather than genuinely malformed output.
      const cause = finishReason === "length"
        ? `response truncated at max_completion_tokens=${maxTokens} before valid JSON`
        : "response is not valid JSON";
      throw new ProviderResponseValidationError("openai", `${cause} for ${schemaName}: ${raw.slice(0, 200)}`);
    }

    return {
      content: parsed as T,
      inputTokens,
      outputTokens,
      finishReason,
    };
  }
}

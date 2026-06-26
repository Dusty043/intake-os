import OpenAI from "openai";

export interface OpenAIDiscoveryConfig {
  apiKey: string;
  model: string;
}

export async function callStructured<T>(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens = 2000,
): Promise<T> {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        strict: true,
        schema,
      },
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`OpenAI returned empty content for ${schemaName}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`OpenAI returned non-JSON for ${schemaName}: ${content.slice(0, 200)}`);
  }

  return parsed as T;
}

export function makeClient(config: OpenAIDiscoveryConfig): OpenAI {
  return new OpenAI({ apiKey: config.apiKey });
}

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getEvalClient(apiKey: string): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey });
  return _client;
}

export async function callEvalStructured<T>(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens = 2500,
): Promise<T> {
  const client = getEvalClient(apiKey);
  const response = await client.chat.completions.create({
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

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`OpenAI returned empty content for ${schemaName}`);

  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch {
    throw new Error(`OpenAI non-JSON for ${schemaName}: ${content.slice(0, 200)}`);
  }
  return parsed as T;
}

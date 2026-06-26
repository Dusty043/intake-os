import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { LowCodePathSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["viable","recommendedTools","fitReasoning","limitations","whenToRejectLowCode"],
  additionalProperties: false,
  properties: {
    viable: { type: "boolean" },
    recommendedTools: { type: "array", items: { type: "string" } },
    fitReasoning: { type: "string" },
    limitations: { type: "array", items: { type: "string" } },
    whenToRejectLowCode: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a no-code/low-code specialist. Assess whether this project could be delivered with low-code tools.
- viable: true if a low-code approach (n8n, Make, Zapier, Bubble, Retool, Airtable, etc.) could deliver 80%+ of the value
- recommendedTools: specific tools that fit this use case
- fitReasoning: why low-code is or is not a good fit (2-3 sentences)
- limitations: what low-code won't handle well for this project
- whenToRejectLowCode: conditions under which you'd switch to a custom build`;

export class OpenAILowCodePathAgent implements EvaluationAgent<LowCodePathSectionContent> {
  readonly role = "low_code_path" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<LowCodePathSectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    const out = await callEvalStructured<LowCodePathSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "low_code_path", schema as unknown as Record<string,unknown>,
    );
    return { sectionKind: "low_code_path", content: out, confidence: 0.78, warnings: [] };
  }
}

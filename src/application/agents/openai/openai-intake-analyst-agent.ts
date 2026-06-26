import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { IntakeBriefSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["title","rawSummary","normalizedSummary","statedGoals","successCriteria","knownConstraints"],
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    rawSummary: { type: "string" },
    normalizedSummary: { type: "string" },
    statedGoals: { type: "array", items: { type: "string" } },
    successCriteria: { type: "array", items: { type: "string" } },
    knownConstraints: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a senior project analyst. Summarize and normalize the intake request.
- normalizedSummary: a concise 1-3 sentence plain-English summary of what is being requested (max 300 chars)
- statedGoals: what the requester wants to achieve (2-5 bullet points)
- successCriteria: what "done" looks like (2-4 measurable criteria)
- knownConstraints: stated deadlines, budget limits, compliance needs, existing systems to integrate with`;

export class OpenAIIntakeAnalystAgent implements EvaluationAgent<IntakeBriefSectionContent> {
  readonly role = "intake_brief" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<IntakeBriefSectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nRequester: ${intake.requester ?? "unknown"}\nDescription:\n${intake.description}`;

    const out = await callEvalStructured<IntakeBriefSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "intake_brief", schema as unknown as Record<string,unknown>,
    );

    return { sectionKind: "intake_brief", content: { ...out, title: intake.title }, confidence: 0.85, warnings: [] };
  }
}

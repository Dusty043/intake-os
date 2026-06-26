import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ClarificationQuestionsSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["isBlocking","questions","missingFields"],
  additionalProperties: false,
  properties: {
    isBlocking: { type: "boolean" },
    questions: {
      type: "array",
      items: {
        type: "object",
        required: ["id","question","reason","required"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          reason: { type: "string" },
          required: { type: "boolean" },
          suggestedAnswerFormat: { type: "string" },
        },
      },
    },
    missingFields: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a requirements analyst. Identify missing information that blocks scoping this project.
- isBlocking: true if there is at least one required question without which the project cannot be scoped
- questions: up to 5 clarifying questions. Set required:true for questions that are truly blocking.
- missingFields: short labels for key missing items (e.g. "tech stack preference", "expected user count")
- Use short IDs like "q1", "q2" etc.`;

export class OpenAIClarificationQuestionsAgent implements EvaluationAgent<ClarificationQuestionsSectionContent> {
  readonly role = "clarification_questions" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ClarificationQuestionsSectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    const out = await callEvalStructured<ClarificationQuestionsSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "clarification_questions", schema as unknown as Record<string,unknown>,
    );
    const warnings = out.isBlocking ? ["Clarification is blocking — evaluation may be incomplete."] : [];
    return { sectionKind: "clarification_questions", content: out, confidence: 0.80, warnings };
  }
}

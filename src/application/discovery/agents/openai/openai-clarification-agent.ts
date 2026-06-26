import OpenAI from "openai";
import type { ClarificationQuestion } from "../../../../domain/discovery.js";
import type { DiscoveryAgentContext, DiscoveryAgentOptions, IClarificationAgent } from "../discovery-agent-contract.js";
import { callStructured, makeClient } from "./openai-discovery-client.js";

const DIMENSIONS = ["problemUnderstanding", "solutionFit", "scopeClarity", "technicalFeasibility", "stakeholderClarity", "downstreamMapping"] as const;

const schema = {
  type: "object",
  required: ["questions"],
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        required: ["question", "impact", "affectedDimensions"],
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          impact: { type: "string", enum: ["blocking", "important", "deferred"] },
          affectedDimensions: { type: "array", items: { type: "string", enum: [...DIMENSIONS] } },
        },
      },
    },
  },
} as const;

type QuestionRaw = {
  question: string;
  impact: "blocking" | "important" | "deferred";
  affectedDimensions: Array<typeof DIMENSIONS[number]>;
};

type Output = { questions: QuestionRaw[] };

const SYSTEM = `You are a requirements analyst. Identify the most important missing information needed to confidently scope this project.

Return at most 3 questions. Prioritise blocking questions (without which the project cannot be scoped) over important or deferred ones.
Do not ask questions that have already been answered in the conversation.
Do not ask vague questions — each must be specific and answerable.`;

export class OpenAIClarificationAgent implements IClarificationAgent {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = makeClient({ apiKey, model });
    this.model = model;
  }

  async planClarifications(ctx: DiscoveryAgentContext, opts: DiscoveryAgentOptions): Promise<ClarificationQuestion[]> {
    const alreadyAnswered = (ctx.existingQuestions ?? []).filter(q => q.answered).map(q => q.question);
    const answeredBlock = alreadyAnswered.length > 0
      ? `Already answered:\n${alreadyAnswered.map(q => `- ${q}`).join("\n")}\n\n`
      : "";

    const conversation = ctx.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const confidence = ctx.currentConfidence;
    const lowDims = Object.entries(confidence)
      .filter(([, v]) => v < 0.6)
      .map(([k]) => k)
      .join(", ");

    const userPrompt = `${answeredBlock}Low-confidence dimensions: ${lowDims || "none"}\n\nConversation:\n${conversation}\n\nWhat clarifying questions are needed?`;

    const out = await callStructured<Output>(
      this.client, this.model,
      SYSTEM, userPrompt,
      "clarification_planning", schema as unknown as Record<string, unknown>,
    );

    return out.questions.map(q => ({
      id: opts.idFactory("clq"),
      question: q.question,
      impact: q.impact,
      affectedDimensions: q.affectedDimensions,
      answered: false,
    }));
  }
}

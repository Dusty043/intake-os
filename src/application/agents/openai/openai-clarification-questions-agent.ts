import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ClarificationQuestionsSectionContent } from "../../intake-evaluation.js";
import type { LlmClient } from "../../llm-client.js";

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
        required: ["id","question","reason","required","suggestedAnswerFormat"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          reason: { type: "string" },
          required: { type: "boolean" },
          suggestedAnswerFormat: { type: ["string", "null"] },
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
- Use short IDs like "q1", "q2" etc.
- If a "Already answered during discovery" section is present, do not flag those items as missing.
- A "Notes from discovery" section may contain two kinds of items, handle them differently:
  - "Open unknowns from discovery": discovery already surfaced these with a recommended default — treat as known open items, not new blocking gaps, unless discovery explicitly left them unresolved for you to decide.
  - "Unconfirmed assumptions discovery made without asking the user": discovery guessed these on the user's behalf without ever confirming them. Take the safest road — if an assumption is consequential (affects cost, data handling, scope, or architecture), turn it into a clarifying question asking the user to confirm or correct it, rather than silently accepting it.`;

export class OpenAIClarificationQuestionsAgent implements EvaluationAgent<ClarificationQuestionsSectionContent> {
  readonly role = "clarification_questions" as const;
  constructor(private readonly client: LlmClient, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ClarificationQuestionsSectionContent>> {
    const { intake } = ctx;
    const priorQA = (ctx.priorClarifications ?? [])
      .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`)
      .join("\n\n");
    const discoveryNotes = (ctx.discoveryNotes ?? []).join("\n\n");
    let userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    if (discoveryNotes) userPrompt += `\n\nNotes from discovery:\n${discoveryNotes}`;
    if (priorQA) userPrompt += `\n\nAlready answered during discovery:\n${priorQA}`;
    const { content: out } = await this.client.completeStructured<ClarificationQuestionsSectionContent>({
      model: this.model, systemPrompt: SYSTEM, userPrompt: userPrompt, schemaName: "clarification_questions", schema: schema as unknown as Record<string,unknown>,
    });
    // Prior clarification answers resolve blocking questions — treat as non-blocking.
    // Matches MockClarificationQuestionsAgent; without this, Discovery-originated
    // intakes get re-blocked at evaluation even though discovery already resolved it.
    const hasPriorAnswers = (ctx.priorClarifications?.length ?? 0) > 0;
    const isBlocking = out.isBlocking && !hasPriorAnswers;
    const content: ClarificationQuestionsSectionContent = { ...out, isBlocking };
    const warnings = isBlocking ? ["Clarification is blocking — evaluation may be incomplete."] : [];
    return { sectionKind: "clarification_questions", content, confidence: 0.80, warnings, isClarificationBlocking: isBlocking };
  }
}

import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ClarificationQuestionsSectionContent } from "../../intake-evaluation.js";
import { normalizeText, containsAny } from "./mock-agent-helpers.js";

export class MockClarificationQuestionsAgent implements EvaluationAgent<ClarificationQuestionsSectionContent> {
  readonly role = "clarification_questions" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ClarificationQuestionsSectionContent>> {
    const { intake } = ctx;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    const missingFields: string[] = [];
    type Question = ClarificationQuestionsSectionContent["questions"][number];
    const questions: Question[] = [];

    if (!intake.title || intake.title.trim().length < 5) {
      missingFields.push("title");
      questions.push({
        id: opts.idFactory("CQ"),
        question: "What is the name or short title of this project?",
        reason: "A clear project title helps route and track the request.",
        required: true,
      });
    }

    if (!intake.description || intake.description.trim().length < 30) {
      missingFields.push("description");
      questions.push({
        id: opts.idFactory("CQ"),
        question: "Can you provide a more detailed description of what you need built?",
        reason: "The description is too short to generate a reliable evaluation.",
        required: true,
        suggestedAnswerFormat: "3-5 sentences describing goals, scope, and expected outcome",
      });
    }

    if (!containsAny(text, ["goal", "outcome", "achieve", "result", "purpose", "why", "business"])) {
      missingFields.push("business_goal");
      questions.push({
        id: opts.idFactory("CQ"),
        question: "What business outcome should this project achieve?",
        reason: "No goal or outcome signal was found in the intake.",
        required: true,
        suggestedAnswerFormat: "Describe the measurable outcome — e.g. 'Reduce manual data entry by 80%'",
      });
    }

    if (!containsAny(text, ["team", "user", "stakeholder", "system", "integration", "scope"])) {
      missingFields.push("scope");
      questions.push({
        id: opts.idFactory("CQ"),
        question: "Which systems, teams, or users are in scope for this project?",
        reason: "No scope signal was detected in the intake description.",
        required: false,
        suggestedAnswerFormat: "List affected systems or teams",
      });
    }

    if (!containsAny(text, ["deadline", "due", "timeline", "when", "launch", "by"])) {
      questions.push({
        id: opts.idFactory("CQ"),
        question: "Is there a target deadline or specific urgency?",
        reason: "No timeline was mentioned — knowing this affects prioritization.",
        required: false,
        suggestedAnswerFormat: "Specific date or relative timeframe (e.g. 'Q3 2026')",
      });
    }

    if (!containsAny(text, ["sensitive", "phi", "hipaa", "compliance", "confidential", "privacy"])) {
      questions.push({
        id: opts.idFactory("CQ"),
        question: "Are there any security, data, or compliance constraints?",
        reason: "Data sensitivity was not mentioned — this affects security review requirements.",
        required: false,
      });
    }

    const criticalMissing = missingFields.filter((f) =>
      f === "description" || f === "title" || f === "business_goal",
    );
    // Prior clarification answers resolve blocking questions — treat as non-blocking.
    const hasPriorAnswers = (ctx.priorClarifications?.length ?? 0) > 0;
    const isBlocking = criticalMissing.length > 0 && !hasPriorAnswers;

    const warnings: string[] = [];
    if (isBlocking) warnings.push(`Clarification is blocking: missing ${criticalMissing.join(", ")}.`);

    return {
      sectionKind: "clarification_questions",
      content: {
        isBlocking,
        questions,
        missingFields,
      },
      confidence: isBlocking ? 0.95 : 0.75,
      warnings,
      isClarificationBlocking: isBlocking,
    };
  }
}

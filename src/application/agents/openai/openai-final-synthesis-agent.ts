import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { SynthesisSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["executiveSummary","recommendedPath","keyDecisions","reviewNotes","approvalReadinessSummary"],
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    recommendedPath: { type: "string" },
    keyDecisions: { type: "array", items: { type: "string" } },
    reviewNotes: { type: "array", items: { type: "string" } },
    approvalReadinessSummary: { type: "string" },
  },
} as const;

const SYSTEM = `You are a technical director synthesizing all evaluation sections into a final recommendation.
- executiveSummary: 3-4 sentence summary of the project and recommendation (include type, stack, effort)
- recommendedPath: the single recommended approach in 1-2 sentences
- keyDecisions: 4-6 key decisions made during evaluation (classification, architecture, tech stack, distribution)
- reviewNotes: important flags for human reviewers (risks, blockers, open questions)
- approvalReadinessSummary: one of: "Ready for approval." / "Ready with notes — see review notes." / "Needs revision — [reason]." / "NOT READY — [blocking reason]."`;

export class OpenAIFinalSynthesisAgent implements EvaluationAgent<SynthesisSectionContent> {
  readonly role = "synthesis" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<SynthesisSectionContent>> {
    const { intake, sections } = ctx;
    const sectionSummary = Object.entries(sections)
      .map(([kind, s]) => `[${kind}]: ${JSON.stringify(s?.content).slice(0, 400)}`)
      .join("\n");
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}\n\nEvaluation sections:\n${sectionSummary}`;
    const out = await callEvalStructured<SynthesisSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "synthesis", schema as unknown as Record<string,unknown>, 2000,
    );
    const isBlocking = out.approvalReadinessSummary.startsWith("NOT READY");
    return { sectionKind: "synthesis", content: out, confidence: isBlocking ? 0.55 : 0.85, warnings: isBlocking ? ["Evaluation is not ready for approval."] : [] };
  }
}

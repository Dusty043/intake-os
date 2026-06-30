import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { WorkBreakdownSectionContent } from "../../intake-evaluation.js";
import type { LlmClient } from "../../llm-client.js";

const schema = {
  type: "object",
  required: ["subtasks","milestones","dependencies"],
  additionalProperties: false,
  properties: {
    subtasks: {
      type: "array",
      items: {
        type: "object",
        required: ["title","description","acceptanceCriteria"],
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          acceptanceCriteria: { type: "array", items: { type: "string" } },
          estimatedHours: { type: "number" },
          suggestedOwnerRole: { type: "string" },
        },
      },
    },
    milestones: { type: "array", items: { type: "string" } },
    dependencies: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a technical project manager. Break this project into concrete subtasks.
- subtasks: 5-12 concrete tasks with clear acceptance criteria. Each should be 4-16 hours.
- suggestedOwnerRole: e.g. "Backend Developer", "Frontend Developer", "DevOps", "QA"
- milestones: 3-5 delivery milestones (e.g. "MVP deployed to staging", "UAT complete")
- dependencies: external dependencies or prerequisites (e.g. "API credentials from vendor", "Design mockups approved")`;

export class OpenAIWorkBreakdownAgent implements EvaluationAgent<WorkBreakdownSectionContent> {
  readonly role = "work_breakdown" as const;
  constructor(private readonly client: LlmClient, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<WorkBreakdownSectionContent>> {
    const { intake } = ctx;
    const arch = ctx.sections.architecture?.content as { recommendedTechStack?: string[] } | undefined;
    const stackNote = arch?.recommendedTechStack ? `Tech stack: ${arch.recommendedTechStack.join(", ")}\n` : "";
    const userPrompt = `${stackNote}Title: ${intake.title}\nDescription:\n${intake.description}`;
    const { content: out } = await this.client.completeStructured<WorkBreakdownSectionContent>({
      model: this.model, systemPrompt: SYSTEM, userPrompt: userPrompt, schemaName: "work_breakdown", schema: schema as unknown as Record<string,unknown>, maxTokens: 3000,
    });
    return { sectionKind: "work_breakdown", content: out, confidence: 0.75, warnings: [] };
  }
}

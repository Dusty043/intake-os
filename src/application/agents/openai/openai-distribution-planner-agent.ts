import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { DistributionPlanSectionContent } from "../../intake-evaluation.js";
import type { LlmClient } from "../../llm-client.js";

const schema = {
  type: "object",
  required: ["monday","github","distributionNotes"],
  additionalProperties: false,
  properties: {
    monday: {
      type: "object",
      required: ["required","suggestedBoard","suggestedGroup","itemName","notes"],
      additionalProperties: false,
      properties: {
        required: { type: "boolean" },
        suggestedBoard: { type: ["string", "null"] },
        suggestedGroup: { type: ["string", "null"] },
        itemName: { type: ["string", "null"] },
        notes: { type: "array", items: { type: "string" } },
      },
    },
    github: {
      type: "object",
      required: ["required","repositoryName","issueLabels","issueBreakdownSuggested"],
      additionalProperties: false,
      properties: {
        required: { type: "boolean" },
        repositoryName: { type: ["string", "null"] },
        issueLabels: { type: "array", items: { type: "string" } },
        issueBreakdownSuggested: { type: "boolean" },
      },
    },
    distributionNotes: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a project distribution planner. Determine how this project should be distributed to Monday and GitHub.
- monday.required: true for projects requiring tracking (almost always true for software projects)
- monday.suggestedBoard: "Projects Portfolio" for new projects
- monday.suggestedGroup: project type group name
- github.required: true if this needs a code repository
- github.repositoryName: kebab-case slug, max 50 chars
- github.issueLabels: 2-4 labels (e.g. "discovery", "web-app", "needs-scoping")
- github.issueBreakdownSuggested: true if work breakdown tasks should become GitHub issues
- distributionNotes: any special distribution considerations`;

export class OpenAIDistributionPlannerAgent implements EvaluationAgent<DistributionPlanSectionContent> {
  readonly role = "distribution_plan" as const;
  constructor(private readonly client: LlmClient, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<DistributionPlanSectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    const { content: out } = await this.client.completeStructured<{ monday: DistributionPlanSectionContent["monday"]; github: DistributionPlanSectionContent["github"]; distributionNotes: string[] }>({
      model: this.model, systemPrompt: SYSTEM, userPrompt: userPrompt, schemaName: "distribution_plan", schema: schema as unknown as Record<string,unknown>,
    });
    const content: DistributionPlanSectionContent = { ...out, dryRunOnly: true };
    return { sectionKind: "distribution_plan", content, confidence: 0.78, warnings: [] };
  }
}

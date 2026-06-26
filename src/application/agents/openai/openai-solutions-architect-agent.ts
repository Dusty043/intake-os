import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ArchitectureSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["recommendation","recommendedTechStack","integrationPoints","dataStores","deploymentNotes","assumptions"],
  additionalProperties: false,
  properties: {
    recommendation: { type: "string" },
    architectureStyle: { type: "string" },
    recommendedTechStack: { type: "array", items: { type: "string" } },
    integrationPoints: { type: "array", items: { type: "string" } },
    dataStores: { type: "array", items: { type: "string" } },
    deploymentNotes: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a solutions architect. Recommend a technical approach for this project.
- recommendation: 2-3 sentence summary of the recommended approach
- architectureStyle: e.g. "monolith", "microservices", "serverless", "n8n workflow", "static site"
- recommendedTechStack: 3-8 technologies (specific, not generic — e.g. "Next.js", "NestJS", "PostgreSQL")
- integrationPoints: external systems or APIs this will connect to
- dataStores: databases, caches, queues needed
- deploymentNotes: hosting, containerization, CI/CD notes
- assumptions: what you're assuming that isn't stated`;

export class OpenAISolutionsArchitectAgent implements EvaluationAgent<ArchitectureSectionContent> {
  readonly role = "architecture" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ArchitectureSectionContent>> {
    const { intake } = ctx;
    const classification = ctx.projectTypeClassification;
    const classNote = classification ? `Classified as: ${classification.projectType}\n` : "";
    const userPrompt = `${classNote}Title: ${intake.title}\nDescription:\n${intake.description}`;
    const out = await callEvalStructured<ArchitectureSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "architecture", schema as unknown as Record<string,unknown>,
    );
    return { sectionKind: "architecture", content: out, confidence: 0.75, warnings: [] };
  }
}

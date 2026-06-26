import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { CustomBuildSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["required","rationale","backendNeeds","frontendNeeds","integrationNeeds","infrastructureNeeds"],
  additionalProperties: false,
  properties: {
    required: { type: "boolean" },
    rationale: { type: "string" },
    backendNeeds: { type: "array", items: { type: "string" } },
    frontendNeeds: { type: "array", items: { type: "string" } },
    integrationNeeds: { type: "array", items: { type: "string" } },
    infrastructureNeeds: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a senior full-stack engineer. Assess whether this project requires a custom software build.
- required: true if custom code is needed (not just configuration)
- rationale: why custom build is or is not required (2-3 sentences)
- backendNeeds: API endpoints, business logic, data processing needed
- frontendNeeds: UI components, pages, interactions needed
- integrationNeeds: third-party APIs, webhooks, external systems
- infrastructureNeeds: hosting, databases, queues, storage, CI/CD`;

export class OpenAICustomBuildAgent implements EvaluationAgent<CustomBuildSectionContent> {
  readonly role = "custom_build" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<CustomBuildSectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    const out = await callEvalStructured<CustomBuildSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "custom_build", schema as unknown as Record<string,unknown>,
    );
    return { sectionKind: "custom_build", content: out, confidence: 0.80, warnings: [] };
  }
}

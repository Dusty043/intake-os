import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ClassificationSectionContent } from "../../intake-evaluation.js";
import type { LlmClient } from "../../llm-client.js";
import { projectTypes } from "../../../domain/types.js";

const DEPTHS = ["light","standard","full"] as const;

const schema = {
  type: "object",
  required: ["projectType","projectSubtype","confidence","reasoning","recommendedDepth","signals"],
  additionalProperties: false,
  properties: {
    // Must match src/domain/types.ts's projectTypes exactly — this is the same
    // enum src/domain/project-type-registry.ts looks up to resolve GitHub
    // requirement/evaluation depth/distribution mode. A value outside this set
    // throws "Unknown project type" deep in provisioning-plan generation.
    projectType: { type: "string", enum: [...projectTypes] },
    projectSubtype: { type: ["string", "null"] },
    confidence: { type: "number" },
    reasoning: { type: "string" },
    recommendedDepth: { type: "string", enum: [...DEPTHS] },
    signals: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a project classification specialist. Classify the intake request.

Project types (pick exactly one):
- n8n_automation: workflow automation built from existing n8n nodes, no custom code
- data_sync_integration: data sync or integration between systems
- internal_dashboard: internal reporting/dashboard tool
- internal_tool: internal tool, process change, bug fix, or microtask
- client_portal: client-facing portal or web app
- saas_platform: multi-tenant SaaS product
- api_service: backend API or service
- ai_workflow_tool: AI-assisted tool, assistant, or AI-driven workflow
- discovery_research: research/discovery only, no implementation yet
- reporting_automation: automated reporting or scheduled report generation

Evaluation depth:
- light: small task or process change, < 5 story points
- standard: medium project with clear requirements
- full: large/complex project, AI/data intensive, or high-risk

confidence: 0.0–1.0 (how certain you are of the classification)
signals: 3-6 keywords or phrases from the intake that drove the classification`;

export class OpenAIProjectClassifierAgent implements EvaluationAgent<ClassificationSectionContent> {
  readonly role = "classification" as const;
  constructor(private readonly client: LlmClient, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ClassificationSectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    const { content: out } = await this.client.completeStructured<ClassificationSectionContent>({
      model: this.model, systemPrompt: SYSTEM, userPrompt: userPrompt, schemaName: "classification", schema: schema as unknown as Record<string,unknown>,
    });
    return { sectionKind: "classification", content: { ...out, confidence: Math.max(0, Math.min(1, out.confidence)) }, confidence: out.confidence, warnings: [] };
  }
}

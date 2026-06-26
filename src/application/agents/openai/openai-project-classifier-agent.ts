import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ClassificationSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const PROJECT_TYPES = ["web_app","mobile_app","automation","dashboard","ai_assistant","api_service","data_pipeline","infrastructure","process_improvement","other"] as const;
const DEPTHS = ["light","standard","full"] as const;

const schema = {
  type: "object",
  required: ["projectType","confidence","reasoning","recommendedDepth","signals"],
  additionalProperties: false,
  properties: {
    projectType: { type: "string", enum: [...PROJECT_TYPES] },
    projectSubtype: { type: "string" },
    confidence: { type: "number" },
    reasoning: { type: "string" },
    recommendedDepth: { type: "string", enum: [...DEPTHS] },
    signals: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a project classification specialist. Classify the intake request.

Project types: web_app, mobile_app, automation, dashboard, ai_assistant, api_service, data_pipeline, infrastructure, process_improvement, other

Evaluation depth:
- light: small task or process change, < 5 story points
- standard: medium project with clear requirements
- full: large/complex project, AI/data intensive, or high-risk

confidence: 0.0–1.0 (how certain you are of the classification)
signals: 3-6 keywords or phrases from the intake that drove the classification`;

export class OpenAIProjectClassifierAgent implements EvaluationAgent<ClassificationSectionContent> {
  readonly role = "classification" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ClassificationSectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    const out = await callEvalStructured<ClassificationSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "classification", schema as unknown as Record<string,unknown>,
    );
    return { sectionKind: "classification", content: { ...out, confidence: Math.max(0, Math.min(1, out.confidence)) }, confidence: out.confidence, warnings: [] };
  }
}

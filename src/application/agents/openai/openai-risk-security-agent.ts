import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { RiskSecuritySectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["risks","dataSensitivity","securityReviewRequired"],
  additionalProperties: false,
  properties: {
    risks: {
      type: "array",
      items: {
        type: "object",
        required: ["title","severity","category","mitigation"],
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["low","medium","high"] },
          category: { type: "string", enum: ["security","privacy","delivery","technical","operational","compliance"] },
          mitigation: { type: "string" },
        },
      },
    },
    dataSensitivity: { type: "string", enum: ["unknown","low","internal","confidential","regulated"] },
    securityReviewRequired: { type: "boolean" },
  },
} as const;

const SYSTEM = `You are a security and risk analyst. Identify risks for this project.
- risks: 2-6 risks. severity: high = blocks delivery or causes data breach; medium = needs mitigation plan; low = monitor
- categories: security, privacy, delivery, technical, operational, compliance
- dataSensitivity: unknown/low/internal/confidential/regulated
- securityReviewRequired: true if auth, PII, payments, compliance, or production infrastructure is involved
- mitigation: specific, actionable mitigation for each risk`;

export class OpenAIRiskSecurityAgent implements EvaluationAgent<RiskSecuritySectionContent> {
  readonly role = "risk_security" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<RiskSecuritySectionContent>> {
    const { intake } = ctx;
    const userPrompt = `Title: ${intake.title}\nDescription:\n${intake.description}`;
    const out = await callEvalStructured<RiskSecuritySectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "risk_security", schema as unknown as Record<string,unknown>,
    );
    const warnings = out.securityReviewRequired ? ["Security review required before distribution approval."] : [];
    return { sectionKind: "risk_security", content: out, confidence: 0.82, warnings };
  }
}

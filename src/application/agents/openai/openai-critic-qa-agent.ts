import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { QualityReviewSectionContent } from "../../intake-evaluation.js";
import { qualityBandFromScore } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["qualityScore","strengths","weaknesses","requiredRevisions","reviewerWarnings"],
  additionalProperties: false,
  properties: {
    qualityScore: {
      type: "object",
      required: ["dimensions","overall"],
      additionalProperties: false,
      properties: {
        dimensions: {
          type: "object",
          required: ["completeness","consistency","specificity","feasibility","riskCoverage","handoffReadiness"],
          additionalProperties: false,
          properties: {
            completeness: { type: "number" },
            consistency: { type: "number" },
            specificity: { type: "number" },
            feasibility: { type: "number" },
            riskCoverage: { type: "number" },
            handoffReadiness: { type: "number" },
          },
        },
        overall: { type: "number" },
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    requiredRevisions: { type: "array", items: { type: "string" } },
    reviewerWarnings: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a critical QA reviewer. Score the quality of this evaluation.

Score all dimensions 0-100:
- completeness: are all required sections present and thorough?
- consistency: do sections agree with each other?
- specificity: are recommendations concrete and actionable?
- feasibility: is the proposed approach realistic?
- riskCoverage: are risks identified and mitigated?
- handoffReadiness: could a developer start from this evaluation?

overall: weighted average (0-100)
strengths: what the evaluation did well (2-4 points)
weaknesses: gaps or inconsistencies found (2-4 points)
requiredRevisions: must-fix items before approval (0-3 items, empty if ready)
reviewerWarnings: flags for the human reviewer`;

export class OpenAICriticQAAgent implements EvaluationAgent<QualityReviewSectionContent> {
  readonly role = "quality_review" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<QualityReviewSectionContent>> {
    const { intake, sections } = ctx;
    const sectionSummary = Object.entries(sections)
      .map(([kind, s]) => `[${kind}]: ${JSON.stringify(s?.content).slice(0, 300)}`)
      .join("\n");
    const userPrompt = `Title: ${intake.title}\n\nEvaluation sections to review:\n${sectionSummary}`;
    const out = await callEvalStructured<Omit<QualityReviewSectionContent, "qualityScore"> & { qualityScore: { dimensions: QualityReviewSectionContent["qualityScore"]["dimensions"]; overall: number } }>(
      this.apiKey, this.model, SYSTEM, userPrompt, "quality_review", schema as unknown as Record<string,unknown>,
    );

    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const dims = {
      completeness: clamp(out.qualityScore.dimensions.completeness),
      consistency: clamp(out.qualityScore.dimensions.consistency),
      specificity: clamp(out.qualityScore.dimensions.specificity),
      feasibility: clamp(out.qualityScore.dimensions.feasibility),
      riskCoverage: clamp(out.qualityScore.dimensions.riskCoverage),
      handoffReadiness: clamp(out.qualityScore.dimensions.handoffReadiness),
    };
    const overall = clamp(out.qualityScore.overall);

    const content: QualityReviewSectionContent = {
      qualityScore: { dimensions: dims, overall, readinessBand: qualityBandFromScore(overall) },
      strengths: out.strengths,
      weaknesses: out.weaknesses,
      requiredRevisions: out.requiredRevisions,
      reviewerWarnings: out.reviewerWarnings,
    };
    return { sectionKind: "quality_review", content, confidence: 0.80, warnings: out.requiredRevisions.length > 0 ? ["Required revisions identified."] : [] };
  }
}

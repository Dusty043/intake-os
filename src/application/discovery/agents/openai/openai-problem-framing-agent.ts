import type { DiscoveryAssumption, DiscoveryConfidence, ProblemFrame } from "../../../../domain/discovery.js";
import type { DiscoveryAgentContext, DiscoveryAgentOptions, IProblemFramingAgent } from "../discovery-agent-contract.js";
import { completeWithUsage } from "../discovery-agent-contract.js";
import type { LlmClient } from "../../../llm-client.js";
import { orgContextBlock } from "../org-context.js";

const schema = {
  type: "object",
  required: ["problemStatement", "affectedUsers", "currentProcess", "painPoints", "businessImpact", "successCriteria", "assumptions", "unknowns", "confidence"],
  additionalProperties: false,
  properties: {
    problemStatement: { type: "string" },
    affectedUsers: { type: "array", items: { type: "string" } },
    currentProcess: { type: "string" },
    painPoints: { type: "array", items: { type: "string" } },
    businessImpact: { type: "string" },
    successCriteria: { type: "array", items: { type: "string" } },
    assumptions: {
      type: "array",
      items: {
        type: "object",
        required: ["assumption", "rationale"],
        additionalProperties: false,
        properties: {
          assumption: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
    unknowns: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      required: ["problemUnderstanding", "solutionFit", "scopeClarity", "technicalFeasibility", "stakeholderClarity", "downstreamMapping"],
      additionalProperties: false,
      properties: {
        problemUnderstanding: { type: "number" },
        solutionFit: { type: "number" },
        scopeClarity: { type: "number" },
        technicalFeasibility: { type: "number" },
        stakeholderClarity: { type: "number" },
        downstreamMapping: { type: "number" },
      },
    },
  },
} as const;

type Output = {
  problemStatement: string;
  affectedUsers: string[];
  currentProcess: string;
  painPoints: string[];
  businessImpact: string;
  successCriteria: string[];
  assumptions: DiscoveryAssumption[];
  unknowns: string[];
  confidence: DiscoveryConfidence;
};

const BASE_SYSTEM = `You are a senior business analyst. Frame the problem clearly and score your confidence.

Score each confidence dimension 0.0–1.0:
- problemUnderstanding: how well you understand the problem
- solutionFit: how clear the solution direction is
- scopeClarity: how well-defined the scope is
- technicalFeasibility: how confident you are it's technically achievable
- stakeholderClarity: how clear the stakeholders and ownership are — score ≥ 0.7 for any clearly internal team request
- downstreamMapping: how clear the Monday/GitHub work items would be — score ≥ 0.7 when the project type clearly maps to one of the known project types

Score 0.3 when information is sparse. Score 0.8+ when the information is thorough.

For each assumption, provide both:
- assumption: the specific thing you're filling in for a gap between what's known and what isn't
- rationale: why you chose this specific fill rather than leaving it blocking, and what makes it the safe (reversible, low-risk, easily corrected) choice if wrong
A bare assumption with no rationale is not acceptable — never omit rationale.`;

export class OpenAIProblemFramingAgent implements IProblemFramingAgent {
  constructor(private readonly client: LlmClient, private readonly model: string) {}

  async frameProblem(ctx: DiscoveryAgentContext, opts: DiscoveryAgentOptions): Promise<{ frame: ProblemFrame; confidence: DiscoveryConfidence }> {
    const system = BASE_SYSTEM + orgContextBlock(opts.orgContext);
    const conversation = ctx.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const intentSummary = ctx.intent ? `Intent: ${ctx.intent.intentType} — ${ctx.intent.underlyingProblem}` : "";
    const userPrompt = `${intentSummary}\n\nConversation:\n${conversation}\n\nFrame this problem.`;

    const out = await completeWithUsage<Output>(this.client, opts, "problem_framing", this.model, {
      systemPrompt: system, userPrompt: userPrompt, schemaName: "problem_framing", schema: schema as unknown as Record<string, unknown>,
    });

    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const confidence: DiscoveryConfidence = {
      problemUnderstanding: clamp(out.confidence.problemUnderstanding),
      solutionFit: clamp(out.confidence.solutionFit),
      scopeClarity: clamp(out.confidence.scopeClarity),
      technicalFeasibility: clamp(out.confidence.technicalFeasibility),
      stakeholderClarity: clamp(out.confidence.stakeholderClarity),
      downstreamMapping: clamp(out.confidence.downstreamMapping),
    };

    return {
      frame: {
        problemStatement: out.problemStatement,
        affectedUsers: out.affectedUsers,
        currentProcess: out.currentProcess,
        painPoints: out.painPoints,
        businessImpact: out.businessImpact,
        successCriteria: out.successCriteria,
        assumptions: out.assumptions,
        unknowns: out.unknowns,
      },
      confidence,
    };
  }
}

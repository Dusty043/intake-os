import type { IntentExtractionResult, IntentType } from "../../../../domain/discovery.js";
import type { DiscoveryAgentContext, DiscoveryAgentOptions, IIntentExtractionAgent } from "../discovery-agent-contract.js";
import { completeWithUsage } from "../discovery-agent-contract.js";
import type { LlmClient } from "../../../llm-client.js";
import { orgContextBlock } from "../org-context.js";

const INTENT_TYPES: IntentType[] = [
  "software_project", "automation", "dashboard_reporting", "ai_assistant",
  "process_improvement", "bug_fix", "microtask", "discovery_request",
  "duplicate", "not_a_project",
];

const schema = {
  type: "object",
  required: ["intentType", "requestedSolution", "underlyingProblem", "solutionBiasDetected", "solutionBiasNote", "confidence"],
  additionalProperties: false,
  properties: {
    intentType: { type: "string", enum: INTENT_TYPES },
    requestedSolution: { type: ["string", "null"] },
    underlyingProblem: { type: "string" },
    solutionBiasDetected: { type: "boolean" },
    solutionBiasNote: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
} as const;

type Output = {
  intentType: IntentType;
  requestedSolution: string | null;
  underlyingProblem: string;
  solutionBiasDetected: boolean;
  solutionBiasNote: string | null;
  confidence: number;
};

const BASE_SYSTEM = `You are a project intake analyst. Classify the user's request and identify the true underlying problem.

Intent types:
- software_project: new web/mobile/backend application
- automation: workflow, script, or process automation (e.g., n8n, Zapier, scheduled jobs)
- dashboard_reporting: analytics, metrics, reporting dashboards
- ai_assistant: LLM-powered tool or agent
- process_improvement: change to how work is done (no software)
- bug_fix: fix something broken in an existing system
- microtask: small one-off task (< 1 day)
- discovery_request: not enough information yet
- duplicate: this request already exists
- not_a_project: out of scope or not actionable

Solution bias = user describes HOW to solve it rather than WHAT problem they have.`;

export class OpenAIIntentExtractionAgent implements IIntentExtractionAgent {
  constructor(private readonly client: LlmClient, private readonly model: string) {}

  async extractIntent(ctx: DiscoveryAgentContext, opts: DiscoveryAgentOptions): Promise<IntentExtractionResult> {
    const system = BASE_SYSTEM + orgContextBlock(opts.orgContext);
    const conversation = ctx.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const userPrompt = `Conversation:\n${conversation}\n\nClassify this request.`;

    const out = await completeWithUsage<Output>(this.client, opts, "intent_extraction", this.model, {
      systemPrompt: system, userPrompt: userPrompt, schemaName: "intent_extraction", schema: schema as unknown as Record<string, unknown>,
    });

    return {
      intentType: out.intentType,
      requestedSolution: out.requestedSolution,
      underlyingProblem: out.underlyingProblem,
      solutionBiasDetected: out.solutionBiasDetected,
      solutionBiasNote: out.solutionBiasNote ?? undefined,
      confidence: Math.max(0, Math.min(1, out.confidence)),
    };
  }
}

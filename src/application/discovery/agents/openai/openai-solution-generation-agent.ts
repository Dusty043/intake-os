import OpenAI from "openai";
import type { SolutionOption } from "../../../../domain/discovery.js";
import type { DiscoveryAgentContext, DiscoveryAgentOptions, ISolutionGenerationAgent } from "../discovery-agent-contract.js";
import { callStructured, makeClient } from "./openai-discovery-client.js";
import { orgContextBlock } from "../org-context.js";

const schema = {
  type: "object",
  required: ["solutions"],
  additionalProperties: false,
  properties: {
    solutions: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "summary", "whenItFits", "whenItIsWrong", "complexity", "dependencies", "risks", "expectedUpside", "isRecommended"],
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          whenItFits: { type: "string" },
          whenItIsWrong: { type: "string" },
          complexity: { type: "string", enum: ["low", "medium", "high"] },
          dependencies: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          expectedUpside: { type: "string" },
          isRecommended: { type: "boolean" },
        },
      },
    },
  },
} as const;

type SolutionRaw = {
  title: string;
  summary: string;
  whenItFits: string;
  whenItIsWrong: string;
  complexity: "low" | "medium" | "high";
  dependencies: string[];
  risks: string[];
  expectedUpside: string;
  isRecommended: boolean;
};

type Output = { solutions: SolutionRaw[] };

const BASE_SYSTEM = `You are a solution architect. Generate 2–4 distinct solution approaches for the described problem.

Each solution should be meaningfully different in approach, complexity, or tradeoffs.
Mark exactly one solution as isRecommended: true (the best fit given what's known).
Order solutions from simplest to most complex.`;

export class OpenAISolutionGenerationAgent implements ISolutionGenerationAgent {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = makeClient({ apiKey, model });
    this.model = model;
  }

  async generateSolutions(ctx: DiscoveryAgentContext, opts: DiscoveryAgentOptions): Promise<SolutionOption[]> {
    const system = BASE_SYSTEM + orgContextBlock(opts.orgContext);
    const conversation = ctx.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const frame = ctx.problemFrame ? `Problem: ${ctx.problemFrame.problemStatement}` : "";
    const userPrompt = `${frame}\n\nConversation:\n${conversation}\n\nGenerate solution options.`;

    const out = await callStructured<Output>(
      this.client, this.model,
      system, userPrompt,
      "solution_generation", schema as unknown as Record<string, unknown>,
    );

    return out.solutions.map((s, i) => ({
      id: opts.idFactory("sol"),
      title: s.title,
      summary: s.summary,
      whenItFits: s.whenItFits,
      whenItIsWrong: s.whenItIsWrong,
      complexity: s.complexity,
      dependencies: s.dependencies,
      risks: s.risks,
      expectedUpside: s.expectedUpside,
      rank: i + 1,
      isRecommended: s.isRecommended,
    }));
  }
}

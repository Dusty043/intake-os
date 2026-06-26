import type { EvaluationAgent, AgentOutput, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { CostEffortSectionContent } from "../../intake-evaluation.js";
import { callEvalStructured } from "./openai-eval-client.js";

const schema = {
  type: "object",
  required: ["estimatedStoryPoints","complexity","costDrivers","costAssumptions","infraCostSignal"],
  additionalProperties: false,
  properties: {
    estimatedStoryPoints: { type: "number" },
    estimatedEngineeringDays: { type: "number" },
    complexity: { type: "string", enum: ["low","medium","high"] },
    costDrivers: { type: "array", items: { type: "string" } },
    costAssumptions: { type: "array", items: { type: "string" } },
    infraCostSignal: { type: "string", enum: ["none","low","medium","high","unknown"] },
  },
} as const;

const SYSTEM = `You are a project estimation specialist using story points (Fibonacci: 1,2,3,5,8,13,21,34).
- estimatedStoryPoints: total effort in SP (1 SP ≈ half a day for a mid-level developer)
- estimatedEngineeringDays: rough calendar days (SP / 2)
- complexity: low (<13 SP), medium (13-34 SP), high (>34 SP)
- costDrivers: 3-5 factors that most influence the estimate
- costAssumptions: what you're assuming (team size, existing infra, no major blockers)
- infraCostSignal: monthly infrastructure cost signal (none=free, low=<$50/mo, medium=$50-500, high=>$500)`;

export class OpenAICostEffortAgent implements EvaluationAgent<CostEffortSectionContent> {
  readonly role = "cost_effort" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<CostEffortSectionContent>> {
    const { intake } = ctx;
    const arch = ctx.sections.architecture?.content as { recommendedTechStack?: string[] } | undefined;
    const stackNote = arch?.recommendedTechStack ? `Tech stack: ${arch.recommendedTechStack.join(", ")}\n` : "";
    const userPrompt = `${stackNote}Title: ${intake.title}\nDescription:\n${intake.description}`;
    const out = await callEvalStructured<CostEffortSectionContent>(
      this.apiKey, this.model, SYSTEM, userPrompt, "cost_effort", schema as unknown as Record<string,unknown>,
    );
    return { sectionKind: "cost_effort", content: { ...out, estimatedStoryPoints: Math.max(1, out.estimatedStoryPoints) }, confidence: 0.70, warnings: [] };
  }
}

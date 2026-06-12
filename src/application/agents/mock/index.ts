import type { EvaluationDepth } from "../../../domain/types.js";
import type { EvaluationAgent, AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { EvaluationSection, EvaluationSectionKind } from "../../intake-evaluation.js";
import { EVALUATION_DEPTH_ROUTING_TABLE } from "../../intake-evaluation.js";
import { MockIntakeAnalystAgent } from "./mock-intake-analyst-agent.js";
import { MockClarificationQuestionsAgent } from "./mock-clarification-questions-agent.js";
import { MockProjectClassifierAgent } from "./mock-project-classifier-agent.js";
import { MockSolutionsArchitectAgent } from "./mock-solutions-architect-agent.js";
import { MockNoCodeLowCodeAgent } from "./mock-low-code-path-agent.js";
import { MockCustomBuildAgent } from "./mock-custom-build-agent.js";
import { MockRiskSecurityAgent } from "./mock-risk-security-agent.js";
import { MockCostEffortAgent } from "./mock-cost-effort-agent.js";
import { MockWorkBreakdownAgent } from "./mock-work-breakdown-agent.js";
import { MockDistributionPlannerAgent } from "./mock-distribution-planner-agent.js";
import { MockFinalSynthesisAgent } from "./mock-final-synthesis-agent.js";
import { MockCriticQAAgent } from "./mock-critic-qa-agent.js";

// ─── Registry ─────────────────────────────────────────────────────────────────

function buildAgentRegistry(): Map<EvaluationSectionKind, EvaluationAgent> {
  const registry = new Map<EvaluationSectionKind, EvaluationAgent>();
  const agents: EvaluationAgent[] = [
    new MockIntakeAnalystAgent(),
    new MockClarificationQuestionsAgent(),
    new MockProjectClassifierAgent(),
    new MockSolutionsArchitectAgent(),
    new MockNoCodeLowCodeAgent(),
    new MockCustomBuildAgent(),
    new MockRiskSecurityAgent(),
    new MockCostEffortAgent(),
    new MockWorkBreakdownAgent(),
    new MockDistributionPlannerAgent(),
    new MockFinalSynthesisAgent(),
    new MockCriticQAAgent(),
  ];
  for (const agent of agents) {
    registry.set(agent.role, agent);
  }
  return registry;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAllMockEvaluationAgents(): EvaluationAgent[] {
  const registry = buildAgentRegistry();
  return Array.from(registry.values());
}

export function createMockEvaluationAgentsForDepth(depth: EvaluationDepth): EvaluationAgent[] {
  const registry = buildAgentRegistry();
  const kinds = EVALUATION_DEPTH_ROUTING_TABLE[depth];
  return kinds
    .map((kind) => registry.get(kind))
    .filter((agent): agent is EvaluationAgent => agent !== undefined);
}

// ─── Test helper ─────────────────────────────────────────────────────────────
// Runs agents sequentially in routing-table order, passing accumulated section
// outputs into the context for downstream agents. Test-only — not the real orchestrator.

export async function runMockEvaluationAgentsSequentiallyForTest(
  intake: AgentRunContext["intake"],
  depth: EvaluationDepth,
  opts: AgentRunOptions,
): Promise<EvaluationSection[]> {
  const agents = createMockEvaluationAgentsForDepth(depth);
  const sections: EvaluationSection[] = [];
  const sectionMap: Partial<Record<EvaluationSectionKind, EvaluationSection>> = {};

  for (const agent of agents) {
    const ctx: AgentRunContext = {
      intake,
      depth,
      sections: { ...sectionMap },
      projectTypeClassification: sectionMap.classification?.content as AgentRunContext["projectTypeClassification"],
    };

    const output = await agent.run(ctx, opts);

    const section: EvaluationSection = {
      id: opts.idFactory("SECTION"),
      evaluationId: opts.idFactory("EVAL"),
      kind: output.sectionKind,
      content: output.content,
      version: 1,
      provenance: {
        provider: opts.provider,
        model: opts.model ?? "mock-pipeline-v1",
        agentRole: output.sectionKind,
        generatedAt: opts.now,
        confidence: output.confidence,
        warnings: output.warnings.length > 0 ? output.warnings : undefined,
      },
    };

    sections.push(section);
    sectionMap[output.sectionKind] = section;
  }

  return sections;
}

// Re-export individual agents for direct access
export {
  MockIntakeAnalystAgent,
  MockClarificationQuestionsAgent,
  MockProjectClassifierAgent,
  MockSolutionsArchitectAgent,
  MockNoCodeLowCodeAgent,
  MockCustomBuildAgent,
  MockRiskSecurityAgent,
  MockCostEffortAgent,
  MockWorkBreakdownAgent,
  MockDistributionPlannerAgent,
  MockFinalSynthesisAgent,
  MockCriticQAAgent,
};

import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ClassificationSectionContent } from "../../intake-evaluation.js";
import {
  normalizeText,
  containsAny,
  inferProjectTypeFromText,
  inferDepthFromText,
} from "./mock-agent-helpers.js";

export class MockProjectClassifierAgent implements EvaluationAgent<ClassificationSectionContent> {
  readonly role = "classification" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ClassificationSectionContent>> {
    const { intake } = ctx;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    // Use intake's existing projectType as strong prior; reclassify from text if needed
    const projectType = intake.projectType ?? inferProjectTypeFromText(text);
    const recommendedDepth = inferDepthFromText(text);
    const signals = extractClassificationSignals(text);

    const confidence = signals.length >= 3 ? 0.85 : signals.length >= 1 ? 0.72 : 0.55;

    const reasoning = buildReasoning(text, projectType, recommendedDepth, signals);

    return {
      sectionKind: "classification",
      content: {
        projectType,
        confidence,
        reasoning,
        recommendedDepth,
        signals,
      },
      confidence,
      warnings: signals.length === 0 ? ["No strong classification signals detected — defaulting to internal_tool."] : [],
    };
  }
}

function extractClassificationSignals(text: string): string[] {
  const SIGNAL_GROUPS: Array<[string[], string]> = [
    [["dashboard", "report", "analytics", "chart", "kpi", "metric", "visualization"], "reporting/dashboard signal"],
    [["api", "endpoint", "webhook", "rest", "graphql", "grpc"], "API/service signal"],
    [["auth", "sso", "oauth", "permission", "rbac", "login", "session"], "auth/security signal"],
    [["portal", "client", "customer", "external"], "external-facing signal"],
    [["migration", "import", "export", "etl", "transform"], "data migration signal"],
    [["automation", "trigger", "workflow", "schedule", "cron"], "automation/workflow signal"],
    [["ai", "llm", "gpt", "claude", "openai", "ml", "vector"], "AI/ML signal"],
    [["infra", "infrastructure", "deploy", "server", "cloud", "aws"], "infrastructure signal"],
    [["saas", "subscription", "billing", "tenant", "multi-tenant"], "SaaS/product signal"],
    [["integration", "sync", "connect", "webhook"], "integration signal"],
  ];

  return SIGNAL_GROUPS
    .filter(([terms]) => containsAny(text, terms))
    .map(([, label]) => label);
}

function buildReasoning(
  text: string,
  projectType: string,
  depth: "light" | "standard" | "full",
  signals: string[],
): string {
  const signalList = signals.length > 0 ? ` Detected signals: ${signals.join(", ")}.` : " No strong signals detected.";
  const depthReason =
    depth === "full" ? "Complexity, risk, or multi-system scope suggests a full evaluation is warranted." :
    depth === "light" ? "The request appears simple and well-scoped — a light evaluation should suffice." :
    "The request has moderate scope — standard evaluation depth is appropriate.";

  return `Classified as ${projectType}.${signalList} ${depthReason}`;
}

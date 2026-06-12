import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { CostEffortSectionContent } from "../../intake-evaluation.js";
import {
  normalizeText,
  containsAny,
  inferComplexity,
  estimateStoryPoints,
} from "./mock-agent-helpers.js";

export class MockCostEffortAgent implements EvaluationAgent<CostEffortSectionContent> {
  readonly role = "cost_effort" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<CostEffortSectionContent>> {
    const { intake } = ctx;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    const complexity = inferComplexity(text);
    const estimatedStoryPoints = estimateStoryPoints(text);
    const estimatedEngineeringDays = Math.round(estimatedStoryPoints * 0.8);
    const costDrivers = buildCostDrivers(text);
    const costAssumptions = buildCostAssumptions(text);
    const infraCostSignal = inferInfraCostSignal(text);

    const warnings: string[] = [];
    if (estimatedStoryPoints > 40) {
      warnings.push("High story point estimate — consider phasing the project into milestones.");
    }
    if (complexity === "high") {
      warnings.push("High complexity detected — estimates carry significant uncertainty.");
    }

    return {
      sectionKind: "cost_effort",
      content: {
        estimatedStoryPoints,
        estimatedEngineeringDays,
        complexity,
        costDrivers,
        costAssumptions,
        infraCostSignal,
      },
      confidence: complexity === "high" ? 0.60 : 0.75,
      warnings,
    };
  }
}

function buildCostDrivers(text: string): string[] {
  const drivers: string[] = [];
  if (containsAny(text, ["integration", "api", "webhook"])) drivers.push("Third-party integrations require API testing and error handling");
  if (containsAny(text, ["auth", "sso", "permission"])) drivers.push("Authentication and permission model implementation");
  if (containsAny(text, ["migration", "data move"])) drivers.push("Data migration, validation, and rollback planning");
  if (containsAny(text, ["ui", "dashboard", "portal", "frontend"])) drivers.push("Frontend development and UI/UX design");
  if (containsAny(text, ["compliance", "hipaa", "gdpr"])) drivers.push("Compliance review and documentation");
  if (containsAny(text, ["infra", "deploy", "aws", "docker"])) drivers.push("Infrastructure provisioning and deployment automation");
  if (drivers.length === 0) drivers.push("Standard implementation and code review");
  return drivers;
}

function buildCostAssumptions(text: string): string[] {
  return [
    "Estimates assume a senior engineer working with existing project infrastructure.",
    "Story points use Fibonacci scale: 1=hours, 5=day, 13=week, 34=sprint.",
    "Estimates exclude product management and stakeholder coordination time.",
    ...(containsAny(text, ["design", "ux", "mockup"]) ? ["UI/UX design effort included in estimates."] : []),
    ...(containsAny(text, ["test", "qa"]) ? ["QA effort included in estimates."] : []),
  ];
}

function inferInfraCostSignal(text: string): CostEffortSectionContent["infraCostSignal"] {
  if (containsAny(text, ["aws", "gcp", "azure", "cloud", "managed service"])) return "medium";
  if (containsAny(text, ["serverless", "lambda", "function"])) return "low";
  if (containsAny(text, ["docker", "container", "k8s", "kubernetes"])) return "medium";
  if (containsAny(text, ["saas platform", "multi-tenant", "high traffic"])) return "high";
  if (containsAny(text, ["internal", "simple", "local"])) return "none";
  return "unknown";
}

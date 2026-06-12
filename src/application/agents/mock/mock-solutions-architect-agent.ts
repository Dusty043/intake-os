import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { ArchitectureSectionContent } from "../../intake-evaluation.js";
import {
  normalizeText,
  containsAny,
  inferTechStack,
  detectIntegrationPoints,
  detectDataStores,
  summarize,
} from "./mock-agent-helpers.js";

export class MockSolutionsArchitectAgent implements EvaluationAgent<ArchitectureSectionContent> {
  readonly role = "architecture" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<ArchitectureSectionContent>> {
    const { intake } = ctx;
    const projectType = ctx.projectTypeClassification?.projectType ?? intake.projectType;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    const recommendedTechStack = inferTechStack(projectType, text);
    const integrationPoints = detectIntegrationPoints(text);
    const dataStores = detectDataStores(text);
    const architectureStyle = inferArchStyle(text, projectType);
    const deploymentNotes = buildDeploymentNotes(text, projectType);
    const assumptions = buildAssumptions(text);

    const recommendation = buildRecommendation(
      intake.title,
      architectureStyle,
      recommendedTechStack,
      integrationPoints,
    );

    const warnings: string[] = [];
    if (integrationPoints.length === 0 && containsAny(text, ["integrate", "connect", "sync"])) {
      warnings.push("Integration signals detected but no recognized external systems found.");
    }

    return {
      sectionKind: "architecture",
      content: {
        recommendation,
        architectureStyle,
        recommendedTechStack,
        integrationPoints,
        dataStores,
        deploymentNotes,
        assumptions,
      },
      confidence: 0.78,
      warnings,
    };
  }
}

function inferArchStyle(text: string, projectType: string): string {
  if (containsAny(text, ["microservice", "distributed", "event-driven"])) return "microservices";
  if (containsAny(text, ["serverless", "lambda", "function"])) return "serverless";
  if (["saas_platform", "api_service"].includes(projectType)) return "layered monolith with API gateway";
  if (containsAny(text, ["n8n", "automation", "workflow"])) return "automation workflow";
  return "layered monolith";
}

function buildDeploymentNotes(text: string, projectType: string): string[] {
  const notes: string[] = [];
  if (containsAny(text, ["vercel", "nextjs", "next.js"])) notes.push("Deploy frontend to Vercel.");
  if (containsAny(text, ["docker", "container"])) notes.push("Containerize API with Docker.");
  if (containsAny(text, ["aws", "ec2", "ecs", "rds"])) notes.push("AWS deployment targeted.");
  if (projectType === "api_service") notes.push("Expose API via documented OpenAPI spec.");
  if (notes.length === 0) notes.push("Deployment target to be confirmed during review.");
  return notes;
}

function buildAssumptions(text: string): string[] {
  const assumptions = ["Team is familiar with the recommended tech stack."];
  if (containsAny(text, ["auth", "sso"])) assumptions.push("Auth provider (Google SSO or similar) is available.");
  if (containsAny(text, ["postgres", "database"])) assumptions.push("PostgreSQL is the primary data store.");
  if (containsAny(text, ["docker"])) assumptions.push("Docker runtime is available in the target environment.");
  return assumptions;
}

function buildRecommendation(
  title: string,
  style: string,
  stack: string[],
  integrations: string[],
): string {
  const topStack = stack.slice(0, 3).join(", ");
  const integrationNote = integrations.length > 0
    ? ` Integrate with: ${integrations.join(", ")}.`
    : "";
  return `Build ${summarize(title, 60)} using a ${style} architecture with ${topStack}.${integrationNote}`;
}

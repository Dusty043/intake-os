import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { CustomBuildSectionContent } from "../../intake-evaluation.js";
import { normalizeText, containsAny } from "./mock-agent-helpers.js";

export class MockCustomBuildAgent implements EvaluationAgent<CustomBuildSectionContent> {
  readonly role = "custom_build" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<CustomBuildSectionContent>> {
    const { intake } = ctx;
    const projectType = ctx.projectTypeClassification?.projectType ?? intake.projectType;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    const backendNeeds = buildBackendNeeds(text, projectType);
    const frontendNeeds = buildFrontendNeeds(text, projectType);
    const integrationNeeds = buildIntegrationNeeds(text);
    const infrastructureNeeds = buildInfraNeeds(text, projectType);

    const hasCustomNeeds =
      backendNeeds.length > 0 || frontendNeeds.length > 0 ||
      integrationNeeds.length > 0 || infrastructureNeeds.length > 0;

    const isLowCodeProjectType = projectType === "n8n_automation" || projectType === "discovery_research";
    const required = hasCustomNeeds && !isLowCodeProjectType;

    const rationale = required
      ? `Custom build is required based on detected needs: ${[...backendNeeds, ...frontendNeeds, ...integrationNeeds].slice(0, 3).join(", ")}.`
      : "No strong custom build signals detected — a low-code or managed solution may suffice.";

    return {
      sectionKind: "custom_build",
      content: {
        required,
        rationale,
        backendNeeds,
        frontendNeeds,
        integrationNeeds,
        infrastructureNeeds,
      },
      confidence: 0.80,
      warnings: [],
    };
  }
}

function buildBackendNeeds(text: string, projectType: string): string[] {
  const needs: string[] = [];
  if (containsAny(text, ["api", "endpoint", "rest", "graphql"])) needs.push("REST/GraphQL API layer");
  if (containsAny(text, ["auth", "sso", "permission", "rbac"])) needs.push("Authentication and authorization service");
  if (containsAny(text, ["database", "postgres", "store", "persist"])) needs.push("Data persistence layer");
  if (containsAny(text, ["job", "queue", "background", "async", "worker"])) needs.push("Background job processing");
  if (containsAny(text, ["webhook", "event", "notify"])) needs.push("Event/webhook handler");
  if (needs.length === 0 && ["internal_tool", "api_service", "saas_platform", "ai_workflow_tool"].includes(projectType)) {
    needs.push("Core business logic API");
  }
  return needs;
}

function buildFrontendNeeds(text: string, projectType: string): string[] {
  const needs: string[] = [];
  if (containsAny(text, ["dashboard", "chart", "visualization", "kpi"])) needs.push("Data visualization dashboard");
  if (containsAny(text, ["form", "input", "submit", "wizard"])) needs.push("User input forms and wizards");
  if (containsAny(text, ["ui", "interface", "portal", "web app"])) needs.push("Web UI/portal frontend");
  if (containsAny(text, ["admin", "management", "crud"])) needs.push("Admin/management interface");
  if (needs.length === 0 && ["internal_dashboard", "client_portal", "saas_platform"].includes(projectType)) {
    needs.push("Standard web UI");
  }
  return needs;
}

function buildIntegrationNeeds(text: string): string[] {
  const needs: string[] = [];
  if (containsAny(text, ["monday", "jira", "trello"])) needs.push("Project management integration");
  if (containsAny(text, ["slack", "teams", "notify"])) needs.push("Notification integration");
  if (containsAny(text, ["salesforce", "crm", "hubspot"])) needs.push("CRM integration");
  if (containsAny(text, ["google", "workspace", "drive", "gmail"])) needs.push("Google Workspace integration");
  if (containsAny(text, ["payment", "stripe", "billing"])) needs.push("Payment processor integration");
  return needs;
}

function buildInfraNeeds(text: string, projectType: string): string[] {
  const needs: string[] = [];
  if (containsAny(text, ["docker", "container"])) needs.push("Containerized deployment");
  if (containsAny(text, ["aws", "gcp", "azure", "cloud"])) needs.push("Cloud hosting setup");
  if (containsAny(text, ["ci", "cd", "pipeline", "github actions"])) needs.push("CI/CD pipeline");
  if (containsAny(text, ["redis", "cache"])) needs.push("Cache layer");
  if (projectType === "saas_platform") needs.push("Multi-tenant infrastructure");
  return needs;
}

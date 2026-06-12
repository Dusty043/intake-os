import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { DistributionPlanSectionContent } from "../../intake-evaluation.js";
import { normalizeText, containsAny, slugify } from "./mock-agent-helpers.js";
import type { CustomBuildSectionContent, ClassificationSectionContent } from "../../intake-evaluation.js";
import { getSection } from "../../intake-evaluation.js";

const GITHUB_REQUIRED_TYPES = [
  "internal_tool", "api_service", "saas_platform", "ai_workflow_tool",
  "data_sync_integration", "client_portal",
];

export class MockDistributionPlannerAgent implements EvaluationAgent<DistributionPlanSectionContent> {
  readonly role = "distribution_plan" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<DistributionPlanSectionContent>> {
    const { intake } = ctx;
    const projectType = ctx.projectTypeClassification?.projectType ?? intake.projectType;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    // Read custom_build section from prior stage if available
    const customBuild = ctx.sections.custom_build?.content as CustomBuildSectionContent | undefined;
    const classification = ctx.sections.classification?.content as ClassificationSectionContent | undefined;

    const githubRequired = determineGithubRequired(text, projectType, customBuild);
    const repositoryName = githubRequired ? slugify(intake.title) : undefined;
    const issueLabels = buildIssueLabels(text, projectType);
    const issueBreakdownSuggested = githubRequired && containsAny(text, ["task", "breakdown", "subtask", "sprint"]);

    const mondayItemName = intake.title.slice(0, 80);
    const suggestedBoard = inferMondayBoard(text, projectType);
    const suggestedGroup = inferMondayGroup(projectType);

    const distributionNotes: string[] = [
      "Distribution is planning-only — no external writes will occur until approved.",
      "Monday item will be created under the suggested board/group after Gate 2 approval.",
    ];
    if (githubRequired) {
      distributionNotes.push(`GitHub repository '${repositoryName}' will be provisioned after approval.`);
      distributionNotes.push("Issue breakdown will be generated from the work breakdown section.");
    } else {
      distributionNotes.push("GitHub repository not required for this project type.");
    }

    return {
      sectionKind: "distribution_plan",
      content: {
        monday: {
          required: true,
          suggestedBoard,
          suggestedGroup,
          itemName: mondayItemName,
          notes: ["Item will include subitems from the work breakdown."],
        },
        github: {
          required: githubRequired,
          repositoryName,
          issueLabels,
          issueBreakdownSuggested,
        },
        dryRunOnly: true,
        distributionNotes,
      },
      confidence: 0.82,
      warnings: [],
    };
  }
}

function determineGithubRequired(text: string, projectType: string, customBuild?: CustomBuildSectionContent): boolean {
  if (customBuild?.required) return true;
  if (GITHUB_REQUIRED_TYPES.includes(projectType)) return true;
  if (containsAny(text, ["code", "app", "build", "develop", "engineer"])) return true;
  return false;
}

function buildIssueLabels(text: string, projectType: string): string[] {
  const labels: string[] = ["intake-generated"];
  if (containsAny(text, ["bug", "fix"])) labels.push("bug");
  if (containsAny(text, ["feature", "new"])) labels.push("enhancement");
  if (containsAny(text, ["security", "auth", "compliance"])) labels.push("security");
  if (containsAny(text, ["migration"])) labels.push("data-migration");
  if (projectType === "ai_workflow_tool") labels.push("ai");
  if (projectType === "infra" || projectType === "api_service") labels.push("infrastructure");
  return labels;
}

function inferMondayBoard(text: string, projectType: string): string {
  if (containsAny(text, ["design", "ux"])) return "Design & Product Board";
  if (projectType === "ai_workflow_tool") return "AI/Automation Projects Board";
  if (containsAny(text, ["infra", "deploy"])) return "Infrastructure Board";
  return "Software Development Board";
}

function inferMondayGroup(projectType: string): string {
  const groupByType: Record<string, string> = {
    internal_tool: "Internal Tools",
    api_service: "Backend Services",
    internal_dashboard: "Dashboards & Reporting",
    reporting_automation: "Automation & Reports",
    n8n_automation: "Workflow Automation",
    saas_platform: "Product / SaaS",
    client_portal: "Client-Facing",
    ai_workflow_tool: "AI/ML Projects",
    data_sync_integration: "Data & Integrations",
    discovery_research: "Research & Discovery",
  };
  return groupByType[projectType] ?? "General";
}

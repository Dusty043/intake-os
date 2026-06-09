import type {
  DistributionMode,
  EvaluationDepth,
  GitHubRequirement,
  ProjectType,
} from "./types.js";

export interface ProjectTypeDefinition {
  projectType: ProjectType;
  displayName: string;
  githubRequirement: GitHubRequirement;
  defaultEvaluationDepth: EvaluationDepth;
  defaultDistributionMode: DistributionMode;
  repoSegment?: string;
}

export const defaultProjectTypeRegistry: readonly ProjectTypeDefinition[] = [
  {
    projectType: "n8n_automation",
    displayName: "n8n Automation",
    githubRequirement: "no",
    defaultEvaluationDepth: "light",
    defaultDistributionMode: "C",
    repoSegment: "n8n",
  },
  {
    projectType: "data_sync_integration",
    displayName: "Data Sync / Integration",
    githubRequirement: "optional",
    defaultEvaluationDepth: "light",
    defaultDistributionMode: "C",
    repoSegment: "integration",
  },
  {
    projectType: "internal_dashboard",
    displayName: "Internal Dashboard",
    githubRequirement: "optional",
    defaultEvaluationDepth: "standard",
    defaultDistributionMode: "B_or_C",
    repoSegment: "dashboard",
  },
  {
    projectType: "internal_tool",
    displayName: "Internal Tool",
    githubRequirement: "yes",
    defaultEvaluationDepth: "standard",
    defaultDistributionMode: "B",
    repoSegment: "tool",
  },
  {
    projectType: "client_portal",
    displayName: "Client Portal",
    githubRequirement: "yes",
    defaultEvaluationDepth: "full",
    defaultDistributionMode: "B",
    repoSegment: "portal",
  },
  {
    projectType: "saas_platform",
    displayName: "SaaS Platform",
    githubRequirement: "yes",
    defaultEvaluationDepth: "full",
    defaultDistributionMode: "B",
    repoSegment: "saas",
  },
  {
    projectType: "api_service",
    displayName: "API Service",
    githubRequirement: "yes",
    defaultEvaluationDepth: "standard",
    defaultDistributionMode: "B",
    repoSegment: "api",
  },
  {
    projectType: "ai_workflow_tool",
    displayName: "AI Workflow Tool",
    githubRequirement: "yes",
    defaultEvaluationDepth: "full",
    defaultDistributionMode: "B",
    repoSegment: "ai-workflow",
  },
  {
    projectType: "discovery_research",
    displayName: "Discovery / Research",
    githubRequirement: "no",
    defaultEvaluationDepth: "light",
    defaultDistributionMode: "none",
  },
  {
    projectType: "reporting_automation",
    displayName: "Reporting Automation",
    githubRequirement: "optional",
    defaultEvaluationDepth: "standard",
    defaultDistributionMode: "C",
    repoSegment: "reporting",
  },
];

const evaluationDepthRank: Record<EvaluationDepth, number> = {
  light: 1,
  standard: 2,
  full: 3,
};

const githubRequirementRank: Record<GitHubRequirement, number> = {
  no: 1,
  optional: 2,
  yes: 3,
};

const distributionModeRank: Record<DistributionMode, number> = {
  none: 1,
  C: 2,
  B_or_C: 3,
  B: 4,
};

export function getProjectTypeDefinition(projectType: ProjectType): ProjectTypeDefinition {
  const definition = defaultProjectTypeRegistry.find(
    (candidate) => candidate.projectType === projectType,
  );

  if (!definition) {
    throw new Error(`Unknown project type: ${projectType}`);
  }

  return definition;
}

export function compareGovernanceBurden(
  left: ProjectTypeDefinition,
  right: ProjectTypeDefinition,
): number {
  const leftScore = governanceScore(left);
  const rightScore = governanceScore(right);
  return leftScore - rightScore;
}

export function selectHighestGovernanceType(projectTypes: readonly ProjectType[]): ProjectTypeDefinition {
  if (projectTypes.length === 0) {
    throw new Error("At least one project type candidate is required.");
  }

  return projectTypes
    .map(getProjectTypeDefinition)
    .sort((left, right) => compareGovernanceBurden(right, left))[0];
}

export function resolveGithubRequirement(
  defaultRequirement: GitHubRequirement,
  approvedRequiresCustomCode?: boolean,
): GitHubRequirement {
  if (defaultRequirement !== "optional") {
    return defaultRequirement;
  }

  if (approvedRequiresCustomCode === true) {
    return "yes";
  }

  if (approvedRequiresCustomCode === false) {
    return "no";
  }

  return "optional";
}

export function isGithubRequirementResolved(requirement: GitHubRequirement): boolean {
  return requirement !== "optional";
}

export function getRequiredEvaluationSections(depth: EvaluationDepth): readonly string[] {
  switch (depth) {
    case "light":
      return ["summary", "systems_involved", "recommended_approach", "assumptions", "basic_work_breakdown"];
    case "standard":
      return [
        "summary",
        "architecture_sketch",
        "implementation_options",
        "dependencies",
        "acceptance_criteria",
        "epics_and_stories",
      ];
    case "full":
      return [
        "summary",
        "architecture_design",
        "deployment_considerations",
        "data_security_considerations",
        "tradeoff_analysis",
        "cost_engineering",
        "operational_concerns",
        "detailed_implementation_plan",
      ];
  }
}

export function getRepoSegmentForProjectType(projectType: ProjectType): string | null {
  return getProjectTypeDefinition(projectType).repoSegment ?? null;
}

function governanceScore(definition: ProjectTypeDefinition): number {
  return (
    evaluationDepthRank[definition.defaultEvaluationDepth] * 100 +
    githubRequirementRank[definition.githubRequirement] * 10 +
    distributionModeRank[definition.defaultDistributionMode]
  );
}

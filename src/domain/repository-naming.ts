import type { ProjectType } from "./types.js";
import { getRepoSegmentForProjectType } from "./project-type-registry.js";

export interface RepositoryNameInput {
  teamPrefix: string;
  projectType: ProjectType;
  projectName: string;
  existingNames?: readonly string[];
  overrideName?: string;
  overrideReason?: string;
  maxLength?: number;
}

export interface RepositoryNameValidation {
  valid: boolean;
  errors: readonly string[];
  collisionDetected: boolean;
}

export interface RepositoryNameResult {
  teamPrefix: string;
  projectTypeSegment: string;
  projectSlug: string;
  proposedRepoName: string;
  finalRepoName: string;
  collisionDetected: boolean;
  overrideReason: string | null;
  validation: RepositoryNameValidation;
}

export interface RepositoryReadmeInput {
  projectName: string;
  summary: string;
  approvedGoal: string;
  inScope: readonly string[];
  outOfScope: readonly string[];
  architectureOverview: readonly string[];
  intakeRecordUrl?: string;
  distributionRecordUrl?: string;
  mondayProjectUrl?: string;
  githubIssuesUrl?: string;
  requestOwner?: string;
  devopsOwner?: string;
  developerOwner?: string;
}

const knownTeamPrefixes: Record<string, string> = {
  "digital solutions": "ds",
  ds: "ds",
  operations: "ops",
  ops: "ops",
  client: "client",
  internal: "internal",
};

const defaultLabels = [
  "bug",
  "enhancement",
  "infrastructure",
  "backend",
  "frontend",
  "automation",
  "ai",
  "blocked",
  "needs-review",
] as const;

const additionalLabelsByProjectType: Partial<Record<ProjectType, readonly string[]>> = {
  api_service: ["api", "integration", "security"],
  client_portal: ["auth", "client-facing"],
  ai_workflow_tool: ["evaluation", "prompting"],
  n8n_automation: ["workflow", "integration"],
};

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeTeamPrefix(input: string): string {
  const normalizedKey = input.trim().toLowerCase();
  return knownTeamPrefixes[normalizedKey] ?? slugify(input);
}

export function generateRepositoryName(input: RepositoryNameInput): RepositoryNameResult {
  const teamPrefix = normalizeTeamPrefix(input.teamPrefix);
  const projectTypeSegment = getRepoSegmentForProjectType(input.projectType) ?? slugify(input.projectType);
  const projectSlug = slugify(input.projectName);
  const proposedRepoName = [teamPrefix, projectTypeSegment, projectSlug].filter(Boolean).join("-");

  if (input.overrideName && !input.overrideReason?.trim()) {
    throw new Error("Manual repository name overrides require an audit reason.");
  }

  const finalRepoName = input.overrideName ? slugify(input.overrideName) : proposedRepoName;
  const validation = validateRepositoryName(finalRepoName, {
    existingNames: input.existingNames,
    maxLength: input.maxLength,
  });

  return {
    teamPrefix,
    projectTypeSegment,
    projectSlug,
    proposedRepoName,
    finalRepoName,
    collisionDetected: validation.collisionDetected,
    overrideReason: input.overrideReason ?? null,
    validation,
  };
}

export function validateRepositoryName(
  name: string,
  options: { existingNames?: readonly string[]; maxLength?: number } = {},
): RepositoryNameValidation {
  const maxLength = options.maxLength ?? 100;
  const existingNames = new Set((options.existingNames ?? []).map((existing) => existing.toLowerCase()));
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push("name_empty");
  }

  if (name !== name.toLowerCase()) {
    errors.push("must_be_lowercase");
  }

  if (/\s/.test(name)) {
    errors.push("must_not_contain_spaces");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    errors.push("must_be_hyphen_separated_lowercase_words");
  }

  if (name.length > maxLength) {
    errors.push("exceeds_max_length");
  }

  if (/(password|secret|token|api-key|apikey|credential)/.test(name)) {
    errors.push("contains_secret_like_term");
  }

  const collisionDetected = existingNames.has(name.toLowerCase());

  if (collisionDetected) {
    errors.push("collision_detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    collisionDetected,
  };
}

export function generateDefaultLabels(projectType: ProjectType): readonly string[] {
  return Array.from(
    new Set([
      ...defaultLabels,
      ...(additionalLabelsByProjectType[projectType] ?? []),
    ]),
  ).sort();
}

export function generateRepositoryReadme(input: RepositoryReadmeInput): string {
  const inScope = renderList(input.inScope);
  const outOfScope = renderList(input.outOfScope);
  const architectureOverview = renderList(input.architectureOverview);

  return `# ${input.projectName}

## Summary

${input.summary}

## Approved Goal

${input.approvedGoal}

## Scope

### In Scope

${inScope}

### Out of Scope

${outOfScope}

## Architecture Overview

${architectureOverview}

## Setup

\`\`\`bash
npm install
\`\`\`

## Environment

Copy \`.env.example\` to \`.env.local\`.

Required variables should use placeholders only. Never commit real secrets.

## Development

\`\`\`bash
npm run dev
\`\`\`

## Tests

\`\`\`bash
npm test
\`\`\`

## Links

- Intake Record: ${input.intakeRecordUrl ?? "TBD"}
- Distribution Record: ${input.distributionRecordUrl ?? "TBD"}
- Monday Project: ${input.mondayProjectUrl ?? "TBD"}
- GitHub Issues: ${input.githubIssuesUrl ?? "TBD"}

## Ownership

- Request Owner: ${input.requestOwner ?? "TBD"}
- DevOps Owner: ${input.devopsOwner ?? "TBD"}
- Developer Owner: ${input.developerOwner ?? "TBD"}
`;
}

function renderList(items: readonly string[]): string {
  if (items.length === 0) {
    return "- TBD";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

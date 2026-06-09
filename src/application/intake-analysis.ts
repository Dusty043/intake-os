import { getProjectTypeDefinition, getRequiredEvaluationSections } from "../domain/project-type-registry.js";
import type { Actor, ProjectType } from "../domain/types.js";
import type { ProjectIntakeRecord } from "./types.js";

export const intakeAnalysisDraftSchemaVersion = "intake-analysis-draft.v1" as const;

export const intakeAnalysisProviders = ["mock", "openai", "anthropic", "manual"] as const;
export type IntakeAnalysisProviderName = (typeof intakeAnalysisProviders)[number];

export const analysisReviewStatuses = ["draft", "accepted", "rejected", "superseded"] as const;
export type AnalysisReviewStatus = (typeof analysisReviewStatuses)[number];

export const analysisComplexityBuckets = ["low", "medium", "high", "unknown"] as const;
export type AnalysisComplexityBucket = (typeof analysisComplexityBuckets)[number];

export const infrastructureRequirementKinds = [
  "github_repository",
  "database",
  "hosting",
  "object_storage",
  "scheduled_worker",
  "third_party_api",
  "monday_board",
  "manual_review",
] as const;
export type InfrastructureRequirementKind = (typeof infrastructureRequirementKinds)[number];

export interface InfrastructureRequirementDraft {
  kind: InfrastructureRequirementKind;
  required: boolean;
  description: string;
  rationale: string;
}

export interface IntakeAnalysisBriefDraft {
  problemStatement: string;
  proposedSolution: string;
  scope: readonly string[];
  deliverables: readonly string[];
  outOfScope: readonly string[];
  assumptions: readonly string[];
  complianceNotes: readonly string[];
}

export interface IntakeAnalysisSubtaskDraft {
  id: string;
  title: string;
  description: string;
  storyPoints: number;
  acceptanceCriteria: readonly string[];
  dependsOn?: readonly string[];
}

export interface DeveloperAssignmentRecommendationDraft {
  developerId?: string;
  displayName?: string;
  confidence: number;
  reason: string;
  matchedSkills: readonly string[];
  workloadSignals: readonly string[];
  risks: readonly string[];
}

export interface IntakeAnalysisDraft {
  id: string;
  intakeId: string;
  schemaVersion: typeof intakeAnalysisDraftSchemaVersion;
  provider: IntakeAnalysisProviderName;
  model: string;
  generatedAt: string;
  generatedBy: Actor;
  reviewStatus: AnalysisReviewStatus;
  sourceSummary: string;
  projectType: ProjectType;
  complexity: AnalysisComplexityBucket;
  estimatedStoryPoints: number;
  confidence: number;
  recommendedTechStack: readonly string[];
  requiredEvaluationSections: readonly string[];
  infrastructureRequirements: readonly InfrastructureRequirementDraft[];
  brief: IntakeAnalysisBriefDraft;
  subtasks: readonly IntakeAnalysisSubtaskDraft[];
  assignmentRecommendation: DeveloperAssignmentRecommendationDraft;
  missingInformation: readonly string[];
  warnings: readonly string[];
}

export interface GenerateMockAnalysisDraftInput {
  sourceInquiryText?: string;
  reviewerContext?: string;
}

export interface IntakeAnalysisDraftValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export interface BuildMockAnalysisDraftOptions {
  now: string;
  actor: Actor;
  idFactory: (prefix: string) => string;
  input?: GenerateMockAnalysisDraftInput;
}

export function buildMockIntakeAnalysisDraft(
  intake: ProjectIntakeRecord,
  options: BuildMockAnalysisDraftOptions,
): IntakeAnalysisDraft {
  const definition = getProjectTypeDefinition(intake.projectType);
  const inquiryText = normalizeWhitespace(options.input?.sourceInquiryText || intake.description);
  const title = intake.title.trim();
  const description = intake.description.trim();
  const combinedText = `${title} ${description} ${inquiryText}`.toLowerCase();
  const complexity = inferComplexity(combinedText, intake.projectType);
  const estimatedStoryPoints = estimateStoryPoints(complexity, intake.projectType, combinedText);
  const missingInformation = inferMissingInformation(combinedText);
  const recommendedTechStack = inferRecommendedStack(intake.projectType, combinedText);
  const infrastructureRequirements = inferInfrastructureRequirements(intake.projectType, combinedText);
  const confidence = clamp(
    0.72 + (description.length > 160 ? 0.08 : 0) - missingInformation.length * 0.04,
    0.45,
    0.9,
  );

  const brief = buildBrief({
    title,
    requester: intake.requester,
    projectTypeDisplayName: definition.displayName,
    inquiryText,
    missingInformation,
    reviewerContext: options.input?.reviewerContext,
  });

  return {
    id: options.idFactory("AIDRAFT"),
    intakeId: intake.id,
    schemaVersion: intakeAnalysisDraftSchemaVersion,
    provider: "mock",
    model: "mock-intake-analysis-v1",
    generatedAt: options.now,
    generatedBy: options.actor,
    reviewStatus: "draft",
    sourceSummary: summarize(inquiryText || description || title, 240),
    projectType: intake.projectType,
    complexity,
    estimatedStoryPoints,
    confidence,
    recommendedTechStack,
    requiredEvaluationSections: getRequiredEvaluationSections(definition.defaultEvaluationDepth),
    infrastructureRequirements,
    brief,
    subtasks: buildSubtasks(intake.projectType, estimatedStoryPoints, infrastructureRequirements),
    assignmentRecommendation: buildAssignmentRecommendation(intake.projectType, recommendedTechStack),
    missingInformation,
    warnings: buildWarnings(missingInformation, infrastructureRequirements),
  };
}

export function validateIntakeAnalysisDraft(draft: IntakeAnalysisDraft): IntakeAnalysisDraftValidationResult {
  const errors: string[] = [];

  if (!draft.id.trim()) {
    errors.push("analysis_draft_id_required");
  }

  if (!draft.intakeId.trim()) {
    errors.push("analysis_draft_intake_id_required");
  }

  if (draft.schemaVersion !== intakeAnalysisDraftSchemaVersion) {
    errors.push("analysis_draft_schema_version_unsupported");
  }

  if (!intakeAnalysisProviders.includes(draft.provider)) {
    errors.push("analysis_draft_provider_unsupported");
  }

  if (!analysisReviewStatuses.includes(draft.reviewStatus)) {
    errors.push("analysis_draft_review_status_unsupported");
  }

  if (!analysisComplexityBuckets.includes(draft.complexity)) {
    errors.push("analysis_draft_complexity_unsupported");
  }

  if (!Number.isFinite(draft.estimatedStoryPoints) || draft.estimatedStoryPoints < 1) {
    errors.push("analysis_draft_story_points_invalid");
  }

  if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 1) {
    errors.push("analysis_draft_confidence_invalid");
  }

  if (draft.recommendedTechStack.length === 0) {
    errors.push("analysis_draft_recommended_stack_required");
  }

  if (draft.infrastructureRequirements.length === 0) {
    errors.push("analysis_draft_infrastructure_requirements_required");
  }

  if (!draft.brief.problemStatement.trim()) {
    errors.push("analysis_draft_problem_statement_required");
  }

  if (!draft.brief.proposedSolution.trim()) {
    errors.push("analysis_draft_solution_required");
  }

  if (draft.brief.scope.length === 0) {
    errors.push("analysis_draft_scope_required");
  }

  if (draft.subtasks.length === 0) {
    errors.push("analysis_draft_subtasks_required");
  }

  for (const subtask of draft.subtasks) {
    if (!subtask.id.trim()) {
      errors.push("analysis_draft_subtask_id_required");
    }

    if (!subtask.title.trim()) {
      errors.push("analysis_draft_subtask_title_required");
    }

    if (!Number.isFinite(subtask.storyPoints) || subtask.storyPoints < 1) {
      errors.push(`analysis_draft_subtask_story_points_invalid:${subtask.id || "unknown"}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildBrief(input: {
  title: string;
  requester: string;
  projectTypeDisplayName: string;
  inquiryText: string;
  missingInformation: readonly string[];
  reviewerContext?: string;
}): IntakeAnalysisBriefDraft {
  const problemStatement = input.inquiryText
    ? summarize(input.inquiryText, 320)
    : `${input.requester} needs ${input.title} assessed and prepared for implementation.`;

  return {
    problemStatement,
    proposedSolution: `Create a ${input.projectTypeDisplayName.toLowerCase()} implementation package for ${input.title}, then route it through human review before distribution.`,
    scope: [
      "Confirm functional requirements and success criteria.",
      "Produce implementation-ready task breakdown with story point estimates.",
      "Identify infrastructure and downstream provisioning requirements.",
    ],
    deliverables: [
      "Reviewed project brief",
      "Task breakdown with estimates",
      "Infrastructure requirement summary",
      "Distribution-ready Monday/GitHub preview",
    ],
    outOfScope: [
      "Live downstream provisioning without approval",
      "Production deployment changes during intake analysis",
    ],
    assumptions: [
      "The submitted inquiry is the primary source of truth until a reviewer edits the draft.",
      "Generated tasks and estimates require human approval before execution.",
      ...(input.reviewerContext ? [`Reviewer context: ${summarize(input.reviewerContext, 160)}`] : []),
    ],
    complianceNotes: input.missingInformation.includes("data sensitivity")
      ? ["Data sensitivity is not confirmed. Treat the intake as review-required before external AI or provisioning use."]
      : ["No explicit compliance blocker detected by the mock analyzer."],
  };
}

function buildSubtasks(
  projectType: ProjectType,
  estimatedStoryPoints: number,
  infrastructureRequirements: readonly InfrastructureRequirementDraft[],
): readonly IntakeAnalysisSubtaskDraft[] {
  const basePoints = Math.max(1, Math.round(estimatedStoryPoints / 5));
  const requiresGithub = infrastructureRequirements.some((requirement) => requirement.kind === "github_repository" && requirement.required);
  const requiresDatabase = infrastructureRequirements.some((requirement) => requirement.kind === "database" && requirement.required);

  const tasks: IntakeAnalysisSubtaskDraft[] = [
    {
      id: "TASK-DRAFT-001",
      title: "Validate intake requirements",
      description: "Review the generated brief with the requester and resolve missing information before implementation starts.",
      storyPoints: Math.max(1, basePoints),
      acceptanceCriteria: ["Reviewer confirms problem statement", "Missing information is resolved or explicitly accepted as a risk"],
    },
    {
      id: "TASK-DRAFT-002",
      title: "Finalize technical approach",
      description: `Confirm the architecture and implementation approach for ${projectType.replaceAll("_", " ")}.`,
      storyPoints: Math.max(2, basePoints),
      acceptanceCriteria: ["Tech stack is approved", "Infrastructure requirements are documented"],
      dependsOn: ["TASK-DRAFT-001"],
    },
  ];

  if (requiresGithub) {
    tasks.push({
      id: "TASK-DRAFT-003",
      title: "Prepare repository structure",
      description: "Define repository name, labels, initial README content, and initial issue set for GitHub preview.",
      storyPoints: Math.max(2, basePoints),
      acceptanceCriteria: ["Repository preview is generated", "Initial issues map to approved subtasks"],
      dependsOn: ["TASK-DRAFT-002"],
    });
  }

  if (requiresDatabase) {
    tasks.push({
      id: "TASK-DRAFT-004",
      title: "Design data model and storage needs",
      description: "Identify entities, retention requirements, and database provisioning assumptions.",
      storyPoints: Math.max(3, basePoints + 1),
      acceptanceCriteria: ["Data model assumptions are documented", "Storage and retention notes are reviewed"],
      dependsOn: ["TASK-DRAFT-002"],
    });
  }

  tasks.push({
    id: "TASK-DRAFT-005",
    title: "Generate downstream distribution preview",
    description: "Create the Monday/GitHub preview package without writing to external systems.",
    storyPoints: Math.max(2, basePoints),
    acceptanceCriteria: ["Preview clearly lists downstream resources", "Reviewer can approve, edit, or reject the package"],
    dependsOn: [requiresGithub ? "TASK-DRAFT-003" : "TASK-DRAFT-002"],
  });

  return tasks;
}

function buildAssignmentRecommendation(
  projectType: ProjectType,
  recommendedTechStack: readonly string[],
): DeveloperAssignmentRecommendationDraft {
  const matchedSkills = recommendedTechStack.slice(0, 4);
  return {
    confidence: 0.52,
    reason: `Mock recommendation only. Match a developer with ${projectType.replaceAll("_", " ")} experience and skills in ${matchedSkills.join(", ")}.`,
    matchedSkills,
    workloadSignals: ["Roster API is not connected in TASK-0005", "Current workload must be reviewed manually"],
    risks: ["Assignment is advisory until roster/workload integration is implemented"],
  };
}

function inferRecommendedStack(projectType: ProjectType, text: string): readonly string[] {
  const stackByType: Record<ProjectType, readonly string[]> = {
    n8n_automation: ["n8n", "HTTP APIs", "Google Workspace", "Monday API"],
    data_sync_integration: ["NestJS", "Postgres", "scheduled worker", "external API client"],
    internal_dashboard: ["Next.js", "NestJS", "Postgres", "dashboard charts"],
    internal_tool: ["Next.js", "NestJS", "Postgres", "Prisma", "Docker"],
    client_portal: ["Next.js", "NestJS", "Postgres", "Google SSO", "Vercel or container hosting"],
    saas_platform: ["Next.js", "NestJS", "Postgres", "Prisma", "AWS", "observability"],
    api_service: ["NestJS", "Postgres", "OpenAPI/Swagger", "Docker"],
    ai_workflow_tool: ["NestJS", "LLM provider", "Postgres", "structured outputs", "audit logging"],
    discovery_research: ["research brief", "architecture decision record", "implementation estimate"],
    reporting_automation: ["scheduled worker", "Postgres", "report generation", "notification adapter"],
  };

  const stack = [...stackByType[projectType]];

  if (text.includes("supabase") && !stack.includes("Supabase")) {
    stack.push("Supabase");
  }

  if (text.includes("chrome") && !stack.includes("Chrome extension APIs")) {
    stack.push("Chrome extension APIs");
  }

  return stack;
}

function inferInfrastructureRequirements(projectType: ProjectType, text: string): readonly InfrastructureRequirementDraft[] {
  const definition = getProjectTypeDefinition(projectType);
  const customCodeLikely = definition.githubRequirement === "yes" || text.includes("app") || text.includes("api") || text.includes("extension");
  const databaseLikely = ["internal_dashboard", "internal_tool", "client_portal", "saas_platform", "api_service", "ai_workflow_tool"].includes(projectType)
    || text.includes("database")
    || text.includes("store")
    || text.includes("dashboard");
  const hostingLikely = customCodeLikely || text.includes("vercel") || text.includes("aws") || text.includes("hosting");
  const scheduledWorkerLikely = projectType === "reporting_automation" || projectType === "data_sync_integration" || text.includes("scheduled") || text.includes("cron");

  return [
    {
      kind: "github_repository",
      required: definition.githubRequirement === "yes" || customCodeLikely,
      description: "GitHub repository for custom code and generated implementation issues.",
      rationale: `Project type default GitHub requirement is ${definition.githubRequirement}.`,
    },
    {
      kind: "database",
      required: databaseLikely,
      description: "Persistent data store for application state, reporting data, or integration checkpoints.",
      rationale: databaseLikely ? "The inquiry or project type suggests durable data." : "No durable data requirement detected by mock analysis.",
    },
    {
      kind: "hosting",
      required: hostingLikely,
      description: "Runtime hosting for app/API/service deployment.",
      rationale: hostingLikely ? "Custom code or external runtime is likely." : "No hosted runtime detected by mock analysis.",
    },
    {
      kind: "scheduled_worker",
      required: scheduledWorkerLikely,
      description: "Background or scheduled execution for sync/reporting/automation workloads.",
      rationale: scheduledWorkerLikely ? "The project type or inquiry suggests recurring execution." : "No recurring execution need detected by mock analysis.",
    },
    {
      kind: "monday_board",
      required: true,
      description: "Monday item/subtask distribution preview for project tracking.",
      rationale: "Every approved intake should produce a reviewable Monday distribution preview.",
    },
  ];
}

function inferComplexity(text: string, projectType: ProjectType): AnalysisComplexityBucket {
  const highSignals = ["hipaa", "baa", "multi-tenant", "production", "aws", "compliance", "migration", "sso"];
  const mediumSignals = ["dashboard", "database", "api", "integration", "github", "automation", "extension"];

  if (["client_portal", "saas_platform", "ai_workflow_tool"].includes(projectType) || highSignals.some((signal) => text.includes(signal))) {
    return "high";
  }

  if (["internal_dashboard", "internal_tool", "api_service", "data_sync_integration", "reporting_automation"].includes(projectType) || mediumSignals.some((signal) => text.includes(signal))) {
    return "medium";
  }

  if (projectType === "discovery_research" || projectType === "n8n_automation") {
    return "low";
  }

  return "unknown";
}

function estimateStoryPoints(complexity: AnalysisComplexityBucket, projectType: ProjectType, text: string): number {
  const baseByComplexity: Record<AnalysisComplexityBucket, number> = {
    low: 5,
    medium: 13,
    high: 34,
    unknown: 8,
  };

  let points = baseByComplexity[complexity];

  if (projectType === "saas_platform") {
    points += 21;
  }

  if (text.includes("chrome")) {
    points += 5;
  }

  if (text.includes("compliance") || text.includes("hipaa") || text.includes("baa")) {
    points += 8;
  }

  return points;
}

function inferMissingInformation(text: string): readonly string[] {
  const missing: string[] = [];

  if (!text.includes("deadline") && !text.includes("due") && !text.includes("timeline")) {
    missing.push("deadline/timeline");
  }

  if (!text.includes("user") && !text.includes("requester") && !text.includes("stakeholder")) {
    missing.push("target users/stakeholders");
  }

  if (!text.includes("data") && !text.includes("database") && !text.includes("api") && !text.includes("source")) {
    missing.push("data sources");
  }

  if (!text.includes("sensitive") && !text.includes("phi") && !text.includes("hipaa") && !text.includes("compliance")) {
    missing.push("data sensitivity");
  }

  return missing;
}

function buildWarnings(
  missingInformation: readonly string[],
  infrastructureRequirements: readonly InfrastructureRequirementDraft[],
): readonly string[] {
  const warnings: string[] = [];

  if (missingInformation.length > 0) {
    warnings.push("Mock analysis detected missing information; reviewer should resolve before approval.");
  }

  if (infrastructureRequirements.some((requirement) => requirement.kind === "database" && requirement.required)) {
    warnings.push("Database need is inferred; retention and data sensitivity review may be required.");
  }

  return warnings;
}

function summarize(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

import { getProjectTypeDefinition, getRequiredEvaluationSections } from "../domain/project-type-registry.js";
import type { Actor, ProjectType } from "../domain/types.js";
import type { ProjectIntakeRecord } from "./types.js";
import type { RosterAssignmentResult } from "./roster/roster-types.js";

export const intakeAnalysisDraftSchemaVersion = "intake-analysis-draft.v1" as const;

export const intakeAnalysisProviders = ["mock", "openai", "anthropic", "bedrock", "manual"] as const;
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
  backupDeveloperId?: string;
  backupDisplayName?: string;
  rosterConnected: boolean;
  scoringSignals?: readonly string[];
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
  proposedArchitecture?: string;
  implementationSuggestions?: readonly string[];
  definitionOfDone?: string;
  openQuestions?: readonly { question: string; askedOf: string; blocking: boolean }[];
  keyDependencies?: readonly { item: string; reason: string; blocking: boolean }[];
}

export interface GenerateMockAnalysisDraftInput {
  sourceInquiryText?: string;
  reviewerContext?: string;
  guidance?: string;
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
  rosterResult?: RosterAssignmentResult;
}

export function buildMockIntakeAnalysisDraft(
  intake: ProjectIntakeRecord,
  options: BuildMockAnalysisDraftOptions,
): IntakeAnalysisDraft {
  const definition = getProjectTypeDefinition(intake.projectType);
  const guidance = options.input?.guidance;
  const inquiryText = normalizeWhitespace(options.input?.sourceInquiryText || intake.description);
  const title = intake.title.trim();
  const description = intake.description.trim();
  const guidanceText = guidance ? normalizeWhitespace(guidance) : "";
  const combinedText = `${title} ${description} ${inquiryText} ${guidanceText}`.toLowerCase();
  const complexity = inferComplexity(combinedText, intake.projectType);
  let estimatedStoryPoints = estimateStoryPoints(complexity, intake.projectType, combinedText);

  if (guidance) {
    // Vary story points based on guidance to produce a visibly different draft.
    const guidanceBias = (guidance.length % 7) - 3;
    estimatedStoryPoints = Math.max(1, estimatedStoryPoints + guidanceBias);
  }

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
    guidance,
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
    assignmentRecommendation: buildAssignmentRecommendation(intake.projectType, recommendedTechStack, options.rosterResult),
    missingInformation,
    warnings: buildWarnings(missingInformation, infrastructureRequirements),
    proposedArchitecture: buildProposedArchitecture(intake.projectType, recommendedTechStack),
    implementationSuggestions: buildImplementationSuggestions(intake.projectType, recommendedTechStack),
    definitionOfDone: buildDefinitionOfDone(intake.projectType, intake.title),
    openQuestions: buildOpenQuestions(missingInformation, intake.projectType),
    keyDependencies: buildKeyDependencies(intake.projectType, recommendedTechStack, combinedText),
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
  guidance?: string;
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
      ...(input.guidance ? [`Steering guidance applied: ${summarize(input.guidance, 200)}`] : []),
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
  roster?: RosterAssignmentResult,
): DeveloperAssignmentRecommendationDraft {
  if (roster?.rosterConnected && roster.recommended) {
    const { member, matchedSkills, riskPenalties, score } = roster.recommended;
    const workloadSignals: string[] = roster.scoringSignals.slice();
    if (member.availability) workloadSignals.push(`Availability: ${member.availability}`);
    if (member.currentLoad != null && member.maxCapacity != null) {
      workloadSignals.push(`Load: ${member.currentLoad}/${member.maxCapacity}`);
    }
    return {
      developerId: member.id,
      displayName: member.name,
      confidence: Math.min(0.95, 0.5 + score * 0.1),
      reason: `Roster match: ${member.name} has ${matchedSkills.length} skill(s) aligned with this ${projectType.replaceAll("_", " ")} project.`,
      matchedSkills,
      workloadSignals,
      risks: riskPenalties,
      backupDeveloperId: roster.backup?.member.id,
      backupDisplayName: roster.backup?.member.name,
      rosterConnected: true,
      scoringSignals: roster.scoringSignals,
    };
  }

  const matchedSkills = recommendedTechStack.slice(0, 4);
  return {
    confidence: 0.52,
    reason: `Advisory only — roster not connected. Match a developer with ${projectType.replaceAll("_", " ")} experience and skills in ${matchedSkills.join(", ")}.`,
    matchedSkills,
    workloadSignals: ["Roster API not connected", "Current workload must be reviewed manually"],
    risks: ["Assignment is advisory until roster integration is complete"],
    rosterConnected: false,
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

function buildDefinitionOfDone(projectType: ProjectType, title: string): string {
  const byType: Record<ProjectType, string> = {
    n8n_automation: `The n8n workflow is live, handles the happy path without manual intervention, error branches are wired, and a non-technical stakeholder has confirmed the output matches expectations.`,
    data_sync_integration: `The sync runs on schedule, processed records match source data, resume-on-failure works after a simulated outage, and a 24-hour run completes with zero unhandled errors.`,
    internal_dashboard: `The dashboard loads in under 3 seconds, displays accurate data verified against the source, role-based access is enforced, and the primary stakeholder has signed off on the data presented.`,
    internal_tool: `The tool is deployed, core workflows function end-to-end, at least one real user has completed a task without guidance, and there are no critical bugs in the issue tracker.`,
    client_portal: `The portal is live with SSO working, at least one client can log in and complete their primary workflow, data isolation between tenants is verified, and the client has accepted the deliverable.`,
    saas_platform: `All core features are shipped behind feature flags, the platform handles the defined load target without degradation, billing integration is live, and the first paying customer is onboarded.`,
    api_service: `The API is deployed, all documented endpoints return correct responses, the OpenAPI spec is published, consumer teams can authenticate and make calls, and error responses are consistent.`,
    ai_workflow_tool: `The AI pipeline runs end-to-end, every AI call is logged with a correlation ID, the human approval gate blocks side effects, and a reviewer has approved at least one real output in staging.`,
    discovery_research: `An Architecture Decision Record (ADR) is written and reviewed, key assumptions are validated with evidence, and the output contains a concrete recommendation with a go/no-go decision.`,
    reporting_automation: `The report runs on schedule, output is delivered to the correct channel, a sample report has been reviewed by the stakeholder for accuracy, and re-delivery works after a simulated failure.`,
  };
  return byType[projectType].replace("$title", title);
}

function buildOpenQuestions(
  missingInformation: readonly string[],
  projectType: ProjectType,
): readonly { question: string; askedOf: string; blocking: boolean }[] {
  const questions: { question: string; askedOf: string; blocking: boolean }[] = [];

  if (missingInformation.includes("deadline/timeline")) {
    questions.push({
      question: "What is the target launch date or deadline? Is there a hard external constraint (e.g. client commitment, regulatory date)?",
      askedOf: "Project requester / stakeholder",
      blocking: true,
    });
  }

  if (missingInformation.includes("target users/stakeholders")) {
    questions.push({
      question: "Who are the primary users and what problem does this solve for them day-to-day?",
      askedOf: "Project requester",
      blocking: true,
    });
  }

  if (missingInformation.includes("data sources")) {
    questions.push({
      question: "What data sources does this system read from or write to? Are there existing APIs or databases to integrate with?",
      askedOf: "Project requester / existing system owner",
      blocking: true,
    });
  }

  if (missingInformation.includes("data sensitivity")) {
    questions.push({
      question: "Does this system handle personal, financial, or health data? Are there compliance requirements (HIPAA, PCI, GDPR)?",
      askedOf: "Legal / compliance team",
      blocking: true,
    });
  }

  const byType: Record<ProjectType, { question: string; askedOf: string; blocking: boolean } | null> = {
    client_portal: { question: "How many tenants are expected at launch and over 12 months? This determines infra sizing.", askedOf: "Project requester / sales", blocking: false },
    saas_platform: { question: "What is the pricing model and who controls plan gating? Dev needs this to implement feature flags correctly.", askedOf: "Product / commercial team", blocking: true },
    n8n_automation: { question: "Who owns the connected credentials (API keys, OAuth) and how are they rotated?", askedOf: "Ops / IT", blocking: true },
    data_sync_integration: { question: "What is the acceptable lag between source data and synced data? Real-time, near-real-time, or batch?", askedOf: "Project requester", blocking: true },
    internal_dashboard: { question: "Is there an existing data source (database, API) or does data need to be ingested fresh?", askedOf: "Data / ops team", blocking: true },
    internal_tool: null,
    api_service: { question: "Which teams or services are the primary consumers? They need to be involved in API design review.", askedOf: "Engineering leads", blocking: false },
    ai_workflow_tool: { question: "What is the acceptable AI error rate and who reviews AI outputs before they take effect?", askedOf: "Product / stakeholder", blocking: true },
    discovery_research: { question: "What is the decision or action this research is unblocking? Success = a decision is made.", askedOf: "Project requester", blocking: true },
    reporting_automation: { question: "Who receives the reports and in what format? Email, Slack, S3, dashboard widget?", askedOf: "Project requester", blocking: true },
  };

  const typeQ = byType[projectType];
  if (typeQ) questions.push(typeQ);

  return questions;
}

function buildKeyDependencies(
  projectType: ProjectType,
  stack: readonly string[],
  text: string,
): readonly { item: string; reason: string; blocking: boolean }[] {
  const deps: { item: string; reason: string; blocking: boolean }[] = [
    {
      item: "Access to this project in the intake OS",
      reason: "Developers need to read the reviewed project package and task breakdown before starting.",
      blocking: true,
    },
  ];

  if (["internal_tool", "internal_dashboard", "client_portal", "saas_platform", "api_service", "ai_workflow_tool", "data_sync_integration", "reporting_automation"].includes(projectType)) {
    deps.push({
      item: "Database provisioning (Postgres)",
      reason: "Schema migrations run at startup — infra must exist before first deploy.",
      blocking: true,
    });
  }

  if (["client_portal", "saas_platform"].includes(projectType)) {
    deps.push({
      item: "Google Workspace / SSO credentials for the target environment",
      reason: "Auth cannot be tested without a real OAuth client ID and secret.",
      blocking: true,
    });
  }

  if (projectType === "n8n_automation") {
    deps.push({
      item: "n8n instance access + credentials for all connected services",
      reason: "Workflow cannot be built or tested without live credentials in the credential store.",
      blocking: true,
    });
  }

  if (projectType === "ai_workflow_tool" || stack.includes("LLM provider")) {
    deps.push({
      item: "AI provider API key (OpenAI / Anthropic / Bedrock)",
      reason: "AI calls fail without a valid key — needed from day one to test the pipeline.",
      blocking: true,
    });
  }

  if (text.includes("github") || ["internal_tool", "saas_platform", "api_service", "client_portal"].includes(projectType)) {
    deps.push({
      item: "GitHub repository provisioned via this intake",
      reason: "Developers need a repo before they can push code. Follow the distribution step in this intake.",
      blocking: true,
    });
  }

  if (projectType === "data_sync_integration") {
    deps.push({
      item: "Read access to the source system / API",
      reason: "The sync worker cannot be tested without being able to pull data from the source.",
      blocking: true,
    });
  }

  deps.push({
    item: "Local development environment matching the stack",
    reason: `Stack is ${stack.slice(0, 3).join(", ")}. Dev machines must run these tools before the first PR can be made.`,
    blocking: false,
  });

  return deps;
}

function buildProposedArchitecture(projectType: ProjectType, stack: readonly string[]): string {
  const primaryStack = stack.slice(0, 3).join(", ");
  const archetypeByType: Record<ProjectType, string> = {
    n8n_automation: "Trigger-based workflow using n8n nodes. HTTP webhook entry point, credential store for external API auth, error-branch handling for retry logic.",
    data_sync_integration: "Scheduled worker with idempotent sync loop. Source-adapter → transform → upsert pipeline. Checkpoint table for resume-on-failure. Dead-letter queue for unprocessable records.",
    internal_dashboard: "Server-rendered Next.js frontend backed by a NestJS API. Read-optimised Postgres views for chart queries. Role-based access guard at the API layer.",
    internal_tool: "Next.js + NestJS monorepo. Domain-driven service layer with Prisma repository pattern. Docker Compose for local dev, container deploy for production.",
    client_portal: "Multi-tenant Next.js app. Google SSO via NextAuth. Row-level Postgres isolation per tenant. NestJS API with per-request actor context.",
    saas_platform: "Multi-tier: Next.js frontend, NestJS API, Postgres primary + read replica. Background worker pool for async jobs. Observability stack (logs, metrics, traces).",
    api_service: "Stateless NestJS REST service. OpenAPI-first with auto-generated client types. Postgres for persistence. Docker image published to container registry.",
    ai_workflow_tool: "Orchestrator service calling one or more LLM providers via adapter pattern. Structured-output schemas for AI responses. Audit log table for every AI call. Human-in-the-loop approval gate before side effects.",
    discovery_research: "Research spike producing an Architecture Decision Record (ADR) and feasibility report. No production code in scope. Outputs feed the next intake.",
    reporting_automation: "Scheduled worker queries Postgres aggregates and renders output (PDF/CSV/email). Delivery adapter is swappable (SMTP, Slack, S3). Retry on transient failure.",
  };
  return `${archetypeByType[projectType]} Primary stack: ${primaryStack}.`;
}

function buildImplementationSuggestions(projectType: ProjectType, stack: readonly string[]): readonly string[] {
  const common = [
    "Start with a working skeleton before adding business logic — confirm the deployment pipeline works on day one.",
    "Write integration tests against the actual data store, not mocks, to catch schema drift early.",
    "Define environment variables in a .env.example and validate required vars at startup.",
  ];
  const byType: Record<ProjectType, readonly string[]> = {
    n8n_automation: [
      "Export the n8n workflow JSON to version control so changes are reviewable.",
      "Use n8n's built-in retry and error-branch nodes rather than custom try/catch logic.",
    ],
    data_sync_integration: [
      "Store a last-synced cursor in the database so the worker can resume after failure.",
      "Test the sync with a small dataset before enabling full production volume.",
    ],
    internal_dashboard: [
      "Add a slow-query log threshold and review any query over 100 ms before launch.",
      "Paginate all list endpoints — even internal dashboards grow unexpectedly.",
    ],
    internal_tool: [
      "Seed the local database with realistic fixture data so the UI is testable without production access.",
      "Add role-check middleware early — retrofitting auth guards is expensive.",
    ],
    client_portal: [
      "Enforce tenant isolation at the database query level, not just the application layer.",
      "Test SSO with a staging identity provider before pointing at production Google Workspace.",
    ],
    saas_platform: [
      "Instrument distributed tracing from day one — latency regressions are hard to find post-launch.",
      "Use feature flags for any functionality that should be gated per plan tier.",
    ],
    api_service: [
      "Generate an OpenAPI spec from code (not the reverse) to keep spec and implementation in sync.",
      "Version the API path from the start (e.g. /v1/) even if v2 is not planned.",
    ],
    ai_workflow_tool: [
      "Log every AI request and response (truncated) with a correlation ID for auditability.",
      "Design the human approval gate as a blocking async step — never let AI side-effects run before it.",
    ],
    discovery_research: [
      "Timebox the spike to avoid scope creep — the output is a decision, not a prototype.",
      "Validate key assumptions with a throwaway proof-of-concept before writing the ADR.",
    ],
    reporting_automation: [
      "Preview the rendered report in staging before scheduling production delivery.",
      "Store a copy of each report output (S3 or DB) for audit and re-delivery.",
    ],
  };
  return [...byType[projectType], ...common];
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

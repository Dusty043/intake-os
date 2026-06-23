import { intakeAnalysisDraftSchemaVersion } from "./intake-analysis.js";
import type { IntakeAnalysisDraft, InfrastructureRequirementDraft, IntakeAnalysisSubtaskDraft } from "./intake-analysis.js";
import type { Actor } from "../domain/types.js";
import {
  getSection,
  qualityBandFromScore,
  EVALUATION_DEPTH_ROUTING_TABLE,
} from "./intake-evaluation.js";
import type {
  ArchitectureSectionContent,
  CostEffortSectionContent,
  DistributionPlanSectionContent,
  IntakeBriefSectionContent,
  IntakeEvaluation,
  QualityReviewSectionContent,
  RiskSecuritySectionContent,
  SynthesisSectionContent,
  WorkBreakdownSectionContent,
  EvaluationSection,
  EvaluationSectionKind,
  EvaluationSectionProvenance,
  ClassificationSectionContent,
  ClarificationQuestionsSectionContent,
} from "./intake-evaluation.js";

// ─── evaluationToLegacyDraft ──────────────────────────────────────────────────

export function evaluationToLegacyDraft(
  evaluation: IntakeEvaluation,
  options: {
    idFactory: (prefix: string) => string;
    now: string;
  },
): IntakeAnalysisDraft {
  const brief = getSection<IntakeBriefSectionContent>(evaluation, "intake_brief");
  const synthesis = getSection<SynthesisSectionContent>(evaluation, "synthesis");
  const architecture = getSection<ArchitectureSectionContent>(evaluation, "architecture");
  const costEffort = getSection<CostEffortSectionContent>(evaluation, "cost_effort");
  const riskSec = getSection<RiskSecuritySectionContent>(evaluation, "risk_security");
  const workBreakdown = getSection<WorkBreakdownSectionContent>(evaluation, "work_breakdown");
  const distribution = getSection<DistributionPlanSectionContent>(evaluation, "distribution_plan");
  const qualityReview = getSection<QualityReviewSectionContent>(evaluation, "quality_review");
  const classification = getSection<ClassificationSectionContent>(evaluation, "classification");
  const clarification = getSection<ClarificationQuestionsSectionContent>(evaluation, "clarification_questions");

  // Summary
  const sourceSummary = synthesis?.content.executiveSummary
    ?? brief?.content.normalizedSummary
    ?? brief?.content.rawSummary
    ?? "";

  // Problem statement
  const problemStatement = brief?.content.rawSummary
    ?? synthesis?.content.recommendedPath
    ?? "See evaluation sections for full details.";

  // Proposed solution
  const proposedSolution = [
    architecture?.content.recommendation,
    synthesis?.content.recommendedPath,
  ].filter(Boolean).join(" ") || "See evaluation sections for full details.";

  // Scope
  const scope: string[] = [
    ...(workBreakdown?.content.subtasks.map((t) => t.title) ?? []),
    ...(architecture?.content.integrationPoints ?? []),
  ];
  if (scope.length === 0) scope.push("Requirements to be confirmed during review.");

  // Out of scope
  const outOfScope: string[] = [
    "Live downstream provisioning without approval",
    ...(distribution?.content.distributionNotes.filter((n) => n.toLowerCase().includes("not")) ?? []),
  ];

  // Deliverables
  const deliverables: string[] = workBreakdown?.content.milestones.length
    ? workBreakdown.content.milestones
    : ["Reviewed evaluation packet", "Task breakdown", "Distribution preview"];

  // Assumptions
  const assumptions: string[] = [
    ...(architecture?.content.assumptions ?? []),
    ...(brief?.content.knownConstraints ?? []),
  ];
  if (assumptions.length === 0) assumptions.push("Requirements confirmed during review.");

  // Compliance notes
  const complianceNotes: string[] = [];
  if (riskSec?.content.securityReviewRequired) {
    complianceNotes.push("Security review required before distribution.");
  }
  if (riskSec?.content.dataSensitivity === "regulated" || riskSec?.content.dataSensitivity === "confidential") {
    complianceNotes.push(`Data sensitivity: ${riskSec.content.dataSensitivity}. Compliance review recommended.`);
  }
  if (complianceNotes.length === 0) {
    complianceNotes.push("No explicit compliance blocker detected by this evaluation.");
  }

  // Tech stack
  const recommendedTechStack = architecture?.content.recommendedTechStack ?? [];

  // Infrastructure requirements
  const infraRequirements: InfrastructureRequirementDraft[] = [];
  if (distribution?.content.github.required) {
    infraRequirements.push({
      kind: "github_repository",
      required: true,
      description: "GitHub repository for custom code.",
      rationale: "Distribution plan requires GitHub.",
    });
  }
  infraRequirements.push({
    kind: "monday_board",
    required: true,
    description: "Monday item for project tracking.",
    rationale: "Distribution plan requires Monday.",
  });
  if (architecture?.content.dataStores.length) {
    infraRequirements.push({
      kind: "database",
      required: true,
      description: architecture.content.dataStores.join(", "),
      rationale: "Architecture requires data storage.",
    });
  }
  if (infraRequirements.length === 0) {
    infraRequirements.push({
      kind: "manual_review",
      required: true,
      description: "Manual review of infrastructure needs required.",
      rationale: "No infrastructure signals detected.",
    });
  }

  // Subtasks
  const subtasks: IntakeAnalysisSubtaskDraft[] = workBreakdown?.content.subtasks.map((t, i) => ({
    id: `EVAL-TASK-${String(i + 1).padStart(3, "0")}`,
    title: t.title,
    description: t.description,
    storyPoints: Math.max(1, Math.round((t.estimatedHours ?? 4) / 4)),
    acceptanceCriteria: t.acceptanceCriteria,
  })) ?? [{
    id: "EVAL-TASK-001",
    title: "Review evaluation and confirm requirements",
    description: "Review the generated evaluation packet with the requester.",
    storyPoints: 2,
    acceptanceCriteria: ["Reviewer confirms the evaluation is accurate"],
  }];

  // Story points
  const estimatedStoryPoints = costEffort?.content.estimatedStoryPoints
    ?? subtasks.reduce((sum, t) => sum + t.storyPoints, 0);

  // Complexity
  const complexity = (costEffort?.content.complexity ?? "unknown") as "low" | "medium" | "high" | "unknown";

  // Confidence
  const confidence = evaluation.qualityScore
    ? Math.max(0, Math.min(1, evaluation.qualityScore.overall / 100))
    : classification?.content.confidence ?? 0.5;

  // Missing information
  const missingInformation: string[] = [
    ...(clarification?.content.missingFields ?? []),
  ];

  // Warnings
  const warnings: string[] = [
    ...(qualityReview?.content.reviewerWarnings ?? []),
  ];
  if (clarification?.content.isBlocking) {
    warnings.push("Clarification is required before this evaluation can be approved.");
  }

  // Project type — use classification result or fall back to intake record
  const projectType = (classification?.content.projectType ?? "internal_tool") as IntakeAnalysisDraft["projectType"];

  // Required evaluation sections from depth routing
  const requiredEvaluationSections = EVALUATION_DEPTH_ROUTING_TABLE[evaluation.depth];

  // Provider + model from first section provenance
  const firstProvenance = evaluation.sections[0]?.provenance;

  return {
    id: options.idFactory("AIDRAFT"),
    intakeId: evaluation.intakeId,
    schemaVersion: intakeAnalysisDraftSchemaVersion,
    provider: firstProvenance?.provider ?? "mock",
    model: firstProvenance?.model ?? "evaluation-pipeline",
    generatedAt: options.now,
    generatedBy: evaluation.createdBy,
    reviewStatus: "draft",
    sourceSummary: sourceSummary.slice(0, 240),
    projectType,
    complexity,
    estimatedStoryPoints: Math.max(1, Math.round(estimatedStoryPoints)),
    confidence,
    recommendedTechStack: recommendedTechStack.length ? recommendedTechStack : ["To be confirmed"],
    requiredEvaluationSections,
    infrastructureRequirements: infraRequirements,
    brief: {
      problemStatement,
      proposedSolution,
      scope,
      deliverables,
      outOfScope,
      assumptions,
      complianceNotes,
    },
    subtasks,
    assignmentRecommendation: {
      confidence: 0.5,
      reason: "Assignment recommendation requires roster integration.",
      matchedSkills: recommendedTechStack.slice(0, 4),
      workloadSignals: ["Roster API not connected"],
      risks: ["Assignment is advisory until roster integration is complete"],
      rosterConnected: false,
    },
    missingInformation,
    warnings,
  };
}

// ─── legacyDraftToEvaluation ──────────────────────────────────────────────────

export function legacyDraftToEvaluation(
  draft: IntakeAnalysisDraft,
  options: {
    intakeId: string;
    createdBy: Actor;
    idFactory: (prefix: string) => string;
    now: string;
  },
): IntakeEvaluation {
  const evalId = options.idFactory("EVAL");
  const now = options.now;

  function makeProvenance(kind: EvaluationSectionKind): EvaluationSectionProvenance {
    return {
      provider: draft.provider as "mock" | "openai" | "anthropic" | "bedrock",
      model: draft.model,
      agentRole: kind,
      generatedAt: draft.generatedAt,
      confidence: draft.confidence,
    };
  }

  function makeSection<TContent>(
    kind: EvaluationSectionKind,
    content: TContent,
  ): EvaluationSection<TContent> {
    return {
      id: options.idFactory("SECTION"),
      evaluationId: evalId,
      kind,
      content,
      version: 1,
      provenance: makeProvenance(kind),
    };
  }

  const intakeBriefSection = makeSection<IntakeBriefSectionContent>("intake_brief", {
    title: draft.intakeId,
    rawSummary: draft.brief.problemStatement,
    normalizedSummary: draft.sourceSummary,
    statedGoals: [...draft.brief.scope],
    successCriteria: [...draft.brief.deliverables],
    knownConstraints: [...draft.brief.assumptions],
  });

  const workBreakdownSection = makeSection<WorkBreakdownSectionContent>("work_breakdown", {
    subtasks: draft.subtasks.map((t) => ({
      title: t.title,
      description: t.description,
      acceptanceCriteria: [...t.acceptanceCriteria],
      estimatedHours: t.storyPoints * 4,
    })),
    milestones: [...draft.brief.deliverables],
    dependencies: [],
  });

  const riskSecSection = makeSection<RiskSecuritySectionContent>("risk_security", {
    risks: draft.brief.complianceNotes.map((note) => ({
      title: note.slice(0, 80),
      severity: "medium" as const,
      category: "compliance" as const,
      mitigation: "Review with stakeholders before approval.",
    })),
    dataSensitivity: "unknown",
    securityReviewRequired: draft.brief.complianceNotes.some((n) =>
      n.toLowerCase().includes("sensitive") || n.toLowerCase().includes("review"),
    ),
  });

  const costEffortSection = makeSection<CostEffortSectionContent>("cost_effort", {
    estimatedStoryPoints: draft.estimatedStoryPoints,
    complexity: draft.complexity === "unknown" ? "medium" : draft.complexity,
    costDrivers: [...draft.brief.assumptions],
    costAssumptions: ["Estimates from legacy draft analysis"],
  });

  const synthSection = makeSection<SynthesisSectionContent>("synthesis", {
    executiveSummary: draft.sourceSummary,
    recommendedPath: draft.brief.proposedSolution,
    keyDecisions: [...draft.brief.scope],
    reviewNotes: [...draft.missingInformation],
    approvalReadinessSummary: draft.warnings.length === 0
      ? "No blockers detected."
      : `${draft.warnings.length} warning(s) require review.`,
  });

  const overallScore = Math.round(draft.confidence * 100);
  const qualitySection = makeSection<QualityReviewSectionContent>("quality_review", {
    qualityScore: {
      dimensions: {
        completeness: overallScore,
        consistency: overallScore,
        specificity: overallScore,
        feasibility: overallScore,
        riskCoverage: draft.brief.complianceNotes.length > 0 ? overallScore : Math.max(0, overallScore - 10),
        handoffReadiness: draft.subtasks.length > 0 ? overallScore : Math.max(0, overallScore - 15),
      },
      overall: overallScore,
      readinessBand: qualityBandFromScore(overallScore),
    },
    strengths: draft.recommendedTechStack.length > 0 ? ["Tech stack identified"] : [],
    weaknesses: [...draft.missingInformation],
    requiredRevisions: [],
    reviewerWarnings: [...draft.warnings],
  });

  const sections: EvaluationSection[] = [
    intakeBriefSection,
    workBreakdownSection,
    riskSecSection,
    costEffortSection,
    synthSection,
    qualitySection,
  ];

  return {
    id: evalId,
    intakeId: options.intakeId,
    depth: "standard",
    sections,
    qualityScore: qualitySection.content.qualityScore,
    status: draft.warnings.length > 0 ? "needs_revision" : "ready_for_review",
    evaluationVersion: 1,
    createdAt: now,
    createdBy: options.createdBy,
  };
}

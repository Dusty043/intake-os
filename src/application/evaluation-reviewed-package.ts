import type { Actor } from "../domain/types.js";
import { projectTypes } from "../domain/types.js";
import type { ProjectType } from "../domain/types.js";
import { getSection } from "./intake-evaluation.js";
import type {
  ArchitectureSectionContent,
  ClassificationSectionContent,
  ClarificationQuestionsSectionContent,
  CostEffortSectionContent,
  DistributionPlanSectionContent,
  IntakeBriefSectionContent,
  IntakeEvaluation,
  SynthesisSectionContent,
  WorkBreakdownSectionContent,
} from "./intake-evaluation.js";
import type { ReviewedProjectPackage } from "./types.js";
import type { AnalysisDraftReviewDecision } from "./types.js";

/**
 * Builds a ReviewedProjectPackage directly from an orchestrator evaluation,
 * so the evaluation is the source of truth for governance on the orchestrator
 * path — no derived IntakeAnalysisDraft twin in between (A-scoped, TASK-0078).
 *
 * The field derivations mirror the package-relevant half of the old
 * evaluationToLegacyDraft, minus the flattening into an intermediate draft.
 */
export function evaluationToReviewedPackage(
  evaluation: IntakeEvaluation,
  opts: {
    actor: Actor;
    now: string;
    idFactory: (prefix: string) => string;
    reviewDecision: AnalysisDraftReviewDecision;
    reviewerNotes?: string;
  },
): ReviewedProjectPackage {
  const brief = getSection<IntakeBriefSectionContent>(evaluation, "intake_brief");
  const synthesis = getSection<SynthesisSectionContent>(evaluation, "synthesis");
  const architecture = getSection<ArchitectureSectionContent>(evaluation, "architecture");
  const costEffort = getSection<CostEffortSectionContent>(evaluation, "cost_effort");
  const workBreakdown = getSection<WorkBreakdownSectionContent>(evaluation, "work_breakdown");
  const distribution = getSection<DistributionPlanSectionContent>(evaluation, "distribution_plan");
  const classification = getSection<ClassificationSectionContent>(evaluation, "classification");
  const clarification = getSection<ClarificationQuestionsSectionContent>(evaluation, "clarification_questions");

  const problem = brief?.content.rawSummary
    ?? synthesis?.content.recommendedPath
    ?? "See evaluation sections for full details.";

  const solution = [
    architecture?.content.recommendation,
    synthesis?.content.recommendedPath,
  ].filter(Boolean).join(" ") || "See evaluation sections for full details.";

  const scope: string[] = [
    ...(workBreakdown?.content.subtasks.map((t) => t.title) ?? []),
    ...(architecture?.content.integrationPoints ?? []),
  ];
  if (scope.length === 0) scope.push("Requirements to be confirmed during review.");

  const outOfScope: string[] = [
    "Live downstream provisioning without approval",
    ...(distribution?.content.distributionNotes.filter((n) => n.toLowerCase().includes("not")) ?? []),
  ];

  const subtasks = (workBreakdown?.content.subtasks ?? []).map((t) => ({
    title: t.title,
    description: t.description,
    storyPoints: Math.max(1, Math.round((t.estimatedHours ?? 4) / 4)),
  }));
  if (subtasks.length === 0) {
    subtasks.push({
      title: "Review evaluation and confirm requirements",
      description: "Review the generated evaluation packet with the requester.",
      storyPoints: 2,
    });
  }

  const estimatedStoryPoints = Math.max(
    1,
    Math.round(costEffort?.content.estimatedStoryPoints ?? subtasks.reduce((sum, t) => sum + t.storyPoints, 0)),
  );

  const rawComplexity = costEffort?.content.complexity ?? "medium";
  const complexity: "low" | "medium" | "high" =
    rawComplexity === "low" || rawComplexity === "high" ? rawComplexity : "medium";

  const recommendedTechStack = architecture?.content.recommendedTechStack ?? [];

  const infrastructureRequirements: string[] = [];
  if (distribution?.content.github.required) {
    infrastructureRequirements.push("GitHub repository for custom code.");
  }
  infrastructureRequirements.push("Monday item for project tracking.");
  if (architecture?.content.dataStores.length) {
    infrastructureRequirements.push(architecture.content.dataStores.join(", "));
  }

  const classifiedType = classification?.content.projectType;
  const projectType: ProjectType =
    classifiedType && (projectTypes as readonly string[]).includes(classifiedType)
      ? (classifiedType as ProjectType)
      : "internal_tool";

  const missingInformation: string[] = [...(clarification?.content.missingFields ?? [])];

  return {
    id: opts.idFactory("RPKG"),
    sourceEvaluationId: evaluation.id,
    intakeId: evaluation.intakeId,
    reviewedBy: opts.actor.id,
    reviewedAt: opts.now,
    reviewDecision: opts.reviewDecision,
    reviewerNotes: opts.reviewerNotes,
    projectType,
    complexity,
    estimatedStoryPoints,
    recommendedTechStack,
    infrastructureRequirements,
    brief: { problem, solution, scope, outOfScope },
    subtasks,
    missingInformation,
  };
}

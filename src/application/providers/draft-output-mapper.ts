import { intakeAnalysisDraftSchemaVersion } from "../intake-analysis.js";
import type { IntakeAnalysisDraft } from "../intake-analysis.js";
import type { AnalysisProviderName } from "../intake-analysis-provider.js";
import type { Actor, ProjectType } from "../../domain/types.js";
import type { AnalysisDraftModelOutput } from "./analysis-draft-output-schema.js";
import { infrastructureRequirementKinds } from "../intake-analysis.js";

export function mapModelOutputToDraft(
  output: AnalysisDraftModelOutput,
  ctx: {
    intakeId: string;
    provider: AnalysisProviderName;
    model: string;
    idFactory: (prefix: string) => string;
    now: string;
    actor: Actor;
  },
): IntakeAnalysisDraft {
  const validInfraKinds = new Set(infrastructureRequirementKinds as readonly string[]);

  const infraRequirements = output.infrastructureRequirements.map((r) => ({
    kind: validInfraKinds.has(r.kind) ? (r.kind as typeof infrastructureRequirementKinds[number]) : ("manual_review" as const),
    required: r.required,
    description: r.description,
    rationale: r.rationale,
  }));

  const subtasks = output.recommendedSubtasks.map((st, i) => ({
    id: `TASK-DRAFT-${String(i + 1).padStart(3, "0")}`,
    title: st.title,
    description: st.description,
    storyPoints: Math.max(1, Math.round(st.storyPoints)),
    acceptanceCriteria: st.acceptanceCriteria,
    ...(st.dependsOn && st.dependsOn.length > 0 ? { dependsOn: st.dependsOn } : {}),
  }));

  return {
    id: ctx.idFactory("AIDRAFT"),
    intakeId: ctx.intakeId,
    schemaVersion: intakeAnalysisDraftSchemaVersion,
    provider: ctx.provider as "mock" | "openai" | "anthropic" | "bedrock" | "manual",
    model: ctx.model,
    generatedAt: ctx.now,
    generatedBy: ctx.actor,
    reviewStatus: "draft",
    sourceSummary: output.summary.slice(0, 240),
    projectType: output.projectType as ProjectType,
    complexity: output.complexity,
    estimatedStoryPoints: Math.max(1, Math.round(output.estimatedStoryPoints)),
    confidence: Math.max(0, Math.min(1, output.confidenceScore)),
    recommendedTechStack: output.recommendedTechStack,
    requiredEvaluationSections: [],
    infrastructureRequirements: infraRequirements,
    brief: {
      problemStatement: output.problemStatement,
      proposedSolution: output.proposedSolution,
      scope: output.scope.inScope,
      deliverables: output.deliverables,
      outOfScope: output.scope.outOfScope,
      assumptions: output.assumptions,
      complianceNotes: output.complianceNotes,
    },
    subtasks,
    assignmentRecommendation: {
      confidence: 0.5,
      reason: "Assignment recommendation pending roster integration.",
      matchedSkills: output.recommendedTechStack.slice(0, 4),
      workloadSignals: ["Roster API not connected"],
      risks: ["Assignment is advisory until roster integration is complete"],
      rosterConnected: false,
    },
    missingInformation: output.missingInformation,
    warnings: output.warnings,
    proposedArchitecture: output.proposedArchitecture,
    implementationSuggestions: output.implementationSuggestions,
    definitionOfDone: output.definitionOfDone,
    openQuestions: output.openQuestions,
    keyDependencies: output.keyDependencies,
  };
}

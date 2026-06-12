import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { SynthesisSectionContent } from "../../intake-evaluation.js";
import type {
  IntakeBriefSectionContent,
  ClassificationSectionContent,
  ArchitectureSectionContent,
  CostEffortSectionContent,
  RiskSecuritySectionContent,
  WorkBreakdownSectionContent,
  DistributionPlanSectionContent,
  ClarificationQuestionsSectionContent,
} from "../../intake-evaluation.js";
import { normalizeText, summarize } from "./mock-agent-helpers.js";

export class MockFinalSynthesisAgent implements EvaluationAgent<SynthesisSectionContent> {
  readonly role = "synthesis" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<SynthesisSectionContent>> {
    const { intake, sections } = ctx;

    const brief = sections.intake_brief?.content as IntakeBriefSectionContent | undefined;
    const classification = sections.classification?.content as ClassificationSectionContent | undefined;
    const architecture = sections.architecture?.content as ArchitectureSectionContent | undefined;
    const costEffort = sections.cost_effort?.content as CostEffortSectionContent | undefined;
    const riskSec = sections.risk_security?.content as RiskSecuritySectionContent | undefined;
    const workBreakdown = sections.work_breakdown?.content as WorkBreakdownSectionContent | undefined;
    const distribution = sections.distribution_plan?.content as DistributionPlanSectionContent | undefined;
    const clarification = sections.clarification_questions?.content as ClarificationQuestionsSectionContent | undefined;

    const executiveSummary = buildExecutiveSummary(
      intake.title,
      brief,
      classification,
      architecture,
      costEffort,
    );

    const recommendedPath = buildRecommendedPath(classification, architecture);
    const keyDecisions = buildKeyDecisions(classification, architecture, distribution);
    const reviewNotes = buildReviewNotes(riskSec, clarification);
    const approvalReadinessSummary = buildApprovalReadiness(clarification, riskSec, costEffort);

    const isBlocking = clarification?.isBlocking ?? false;
    const warnings: string[] = [];
    if (isBlocking) warnings.push("Clarification is still blocking — evaluation may be incomplete.");

    return {
      sectionKind: "synthesis",
      content: {
        executiveSummary,
        recommendedPath,
        keyDecisions,
        reviewNotes,
        approvalReadinessSummary,
      },
      confidence: isBlocking ? 0.55 : 0.80,
      warnings,
    };
  }
}

function buildExecutiveSummary(
  title: string,
  brief?: IntakeBriefSectionContent,
  classification?: ClassificationSectionContent,
  architecture?: ArchitectureSectionContent,
  costEffort?: CostEffortSectionContent,
): string {
  const normalizedTitle = normalizeText(title);
  const typeLabel = classification?.projectType?.replace(/_/g, " ") ?? "internal tool";
  const summary = brief?.normalizedSummary ?? brief?.rawSummary ?? `Build ${normalizedTitle}.`;
  const stackNote = architecture ? ` Tech stack: ${architecture.recommendedTechStack.slice(0, 3).join(", ")}.` : "";
  const effortNote = costEffort
    ? ` Estimated: ${costEffort.estimatedStoryPoints} story points (${costEffort.complexity} complexity).`
    : "";

  return summarize(`${summary} Classified as ${typeLabel}.${stackNote}${effortNote}`, 400);
}

function buildRecommendedPath(
  classification?: ClassificationSectionContent,
  architecture?: ArchitectureSectionContent,
): string {
  if (architecture?.recommendation) return architecture.recommendation;
  if (classification) {
    const depth = classification.recommendedDepth;
    return `${depth.charAt(0).toUpperCase() + depth.slice(1)}-depth custom build for ${classification.projectType.replace(/_/g, " ")}.`;
  }
  return "Proceed with standard custom build after resolving open questions.";
}

function buildKeyDecisions(
  classification?: ClassificationSectionContent,
  architecture?: ArchitectureSectionContent,
  distribution?: DistributionPlanSectionContent,
): string[] {
  const decisions: string[] = [];
  if (classification) decisions.push(`Project classified as ${classification.projectType.replace(/_/g, " ")} (confidence: ${Math.round(classification.confidence * 100)}%)`);
  if (architecture?.architectureStyle) decisions.push(`Architecture style: ${architecture.architectureStyle}`);
  if (architecture?.recommendedTechStack.length) decisions.push(`Tech stack: ${architecture.recommendedTechStack.slice(0, 4).join(", ")}`);
  if (distribution?.github.required) decisions.push(`GitHub repository required: ${distribution.github.repositoryName ?? "name to be confirmed"}`);
  if (distribution?.monday.suggestedBoard) decisions.push(`Monday board: ${distribution.monday.suggestedBoard}`);
  if (decisions.length === 0) decisions.push("No key decisions recorded — review sections for details");
  return decisions;
}

function buildReviewNotes(
  riskSec?: RiskSecuritySectionContent,
  clarification?: ClarificationQuestionsSectionContent,
): string[] {
  const notes: string[] = [];
  if (clarification?.missingFields.length) {
    notes.push(`Missing information: ${clarification.missingFields.join(", ")}.`);
  }
  const highRisks = riskSec?.risks.filter((r) => r.severity === "high") ?? [];
  if (highRisks.length > 0) {
    notes.push(`${highRisks.length} high-severity risk(s) identified: ${highRisks.map((r) => r.title).join("; ")}.`);
  }
  if (riskSec?.securityReviewRequired) {
    notes.push("Security review is required before distribution approval.");
  }
  if (notes.length === 0) notes.push("No critical review blockers detected.");
  return notes;
}

function buildApprovalReadiness(
  clarification?: ClarificationQuestionsSectionContent,
  riskSec?: RiskSecuritySectionContent,
  costEffort?: CostEffortSectionContent,
): string {
  if (clarification?.isBlocking) {
    return "NOT READY — clarification is blocking. Resolve required questions before approval.";
  }
  const highRiskCount = riskSec?.risks.filter((r) => r.severity === "high").length ?? 0;
  if (highRiskCount >= 2) {
    return `NEEDS REVIEW — ${highRiskCount} high-severity risks require mitigation plan before approval.`;
  }
  const pts = costEffort?.estimatedStoryPoints;
  const complexityNote = costEffort?.complexity === "high" ? " High complexity — ensure stakeholder alignment." : "";
  return `Ready for review.${complexityNote}${pts ? ` Estimated: ${pts} story points.` : ""}`;
}

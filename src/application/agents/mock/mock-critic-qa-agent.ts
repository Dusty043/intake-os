import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { QualityReviewSectionContent, QualityScore } from "../../intake-evaluation.js";
import { qualityBandFromScore } from "../../intake-evaluation.js";
import type {
  ClarificationQuestionsSectionContent,
  WorkBreakdownSectionContent,
  RiskSecuritySectionContent,
  ArchitectureSectionContent,
  SynthesisSectionContent,
  IntakeBriefSectionContent,
} from "../../intake-evaluation.js";
import { clamp } from "./mock-agent-helpers.js";

export class MockCriticQAAgent implements EvaluationAgent<QualityReviewSectionContent> {
  readonly role = "quality_review" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<QualityReviewSectionContent>> {
    const { sections } = ctx;

    const clarification = sections.clarification_questions?.content as ClarificationQuestionsSectionContent | undefined;
    const workBreakdown = sections.work_breakdown?.content as WorkBreakdownSectionContent | undefined;
    const riskSec = sections.risk_security?.content as RiskSecuritySectionContent | undefined;
    const architecture = sections.architecture?.content as ArchitectureSectionContent | undefined;
    const synthesis = sections.synthesis?.content as SynthesisSectionContent | undefined;
    const brief = sections.intake_brief?.content as IntakeBriefSectionContent | undefined;

    const isBlocking = clarification?.isBlocking ?? false;
    const hasWorkBreakdown = (workBreakdown?.subtasks.length ?? 0) > 0;
    const hasRisks = (riskSec?.risks.length ?? 0) > 0;
    const hasArchitecture = !!architecture?.recommendation;
    const hasSynthesis = !!synthesis?.executiveSummary;

    const sectionCount = Object.keys(sections).length;

    // Score each dimension 0–100
    const completeness = scoreCompleteness(sectionCount, isBlocking, brief);
    const consistency = scoreConsistency(hasArchitecture, hasSynthesis, hasWorkBreakdown);
    const specificity = scoreSpecificity(workBreakdown, architecture, brief);
    const feasibility = scoreFeasibility(riskSec, isBlocking);
    const riskCoverage = scoreRiskCoverage(hasRisks, riskSec);
    const handoffReadiness = scoreHandoffReadiness(hasWorkBreakdown, workBreakdown, isBlocking);

    const overall = clamp(
      Math.round((completeness + consistency + specificity + feasibility + riskCoverage + handoffReadiness) / 6),
      0,
      100,
    );

    const readinessBand = qualityBandFromScore(overall);

    const qualityScore: QualityScore = {
      dimensions: { completeness, consistency, specificity, feasibility, riskCoverage, handoffReadiness },
      overall,
      readinessBand,
    };

    const strengths = buildStrengths(hasArchitecture, hasRisks, hasWorkBreakdown, hasSynthesis);
    const weaknesses = buildWeaknesses(isBlocking, !hasWorkBreakdown, !hasRisks, sectionCount);
    const requiredRevisions = buildRequiredRevisions(isBlocking, workBreakdown, riskSec);
    const reviewerWarnings = buildReviewerWarnings(isBlocking, riskSec, qualityScore);

    return {
      sectionKind: "quality_review",
      content: {
        qualityScore,
        strengths,
        weaknesses,
        requiredRevisions,
        reviewerWarnings,
      },
      confidence: isBlocking ? 0.95 : 0.85,
      warnings: reviewerWarnings,
    };
  }
}

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreCompleteness(sectionCount: number, isBlocking: boolean, brief?: IntakeBriefSectionContent): number {
  let score = 60;
  score += Math.min(20, sectionCount * 3); // up to +20 for sections present
  if (brief?.statedGoals.length) score += 5;
  if (brief?.successCriteria.length) score += 5;
  if (isBlocking) score -= 30;
  return clamp(score, 0, 100);
}

function scoreConsistency(hasArch: boolean, hasSynth: boolean, hasWb: boolean): number {
  let score = 65;
  if (hasArch) score += 10;
  if (hasSynth) score += 10;
  if (hasWb) score += 10;
  return clamp(score, 0, 100);
}

function scoreSpecificity(
  wb?: WorkBreakdownSectionContent,
  arch?: ArchitectureSectionContent,
  brief?: IntakeBriefSectionContent,
): number {
  let score = 55;
  if ((wb?.subtasks.length ?? 0) >= 3) score += 15;
  if ((wb?.subtasks.length ?? 0) >= 6) score += 5;
  if ((arch?.recommendedTechStack.length ?? 0) >= 3) score += 10;
  if ((arch?.integrationPoints.length ?? 0) > 0) score += 5;
  if ((brief?.knownConstraints.length ?? 0) > 0) score += 5;
  return clamp(score, 0, 100);
}

function scoreFeasibility(riskSec?: RiskSecuritySectionContent, isBlocking?: boolean): number {
  let score = 75;
  const highRisks = riskSec?.risks.filter((r) => r.severity === "high").length ?? 0;
  score -= highRisks * 8;
  if (isBlocking) score -= 20;
  return clamp(score, 0, 100);
}

function scoreRiskCoverage(hasRisks: boolean, riskSec?: RiskSecuritySectionContent): number {
  if (!hasRisks) return 45;
  let score = 70;
  const riskCount = riskSec?.risks.length ?? 0;
  if (riskCount >= 2) score += 10;
  if (riskCount >= 4) score += 10;
  if (riskSec?.dataSensitivity && riskSec.dataSensitivity !== "unknown") score += 5;
  return clamp(score, 0, 100);
}

function scoreHandoffReadiness(hasWb: boolean, wb?: WorkBreakdownSectionContent, isBlocking?: boolean): number {
  if (!hasWb) return 40;
  let score = 65;
  const subtaskCount = wb?.subtasks.length ?? 0;
  if (subtaskCount >= 3) score += 10;
  if (subtaskCount >= 6) score += 10;
  const hasAcceptanceCriteria = wb?.subtasks.every((s) => s.acceptanceCriteria.length > 0) ?? false;
  if (hasAcceptanceCriteria) score += 10;
  if (isBlocking) score -= 20;
  return clamp(score, 0, 100);
}

// ─── Narrative builders ───────────────────────────────────────────────────────

function buildStrengths(hasArch: boolean, hasRisks: boolean, hasWb: boolean, hasSynth: boolean): string[] {
  const s: string[] = [];
  if (hasArch) s.push("Architecture recommendation is present with tech stack");
  if (hasRisks) s.push("Risk and security section covers key risk categories");
  if (hasWb) s.push("Work breakdown includes subtasks with acceptance criteria");
  if (hasSynth) s.push("Executive summary provided for stakeholder review");
  if (s.length === 0) s.push("Evaluation structure is in place");
  return s;
}

function buildWeaknesses(isBlocking: boolean, noWb: boolean, noRisks: boolean, sectionCount: number): string[] {
  const w: string[] = [];
  if (isBlocking) w.push("Clarification is blocking — critical information is missing");
  if (noWb) w.push("No work breakdown generated — effort estimates are unavailable");
  if (noRisks) w.push("No risks identified — risk coverage is incomplete");
  if (sectionCount < 4) w.push("Few evaluation sections present — evaluation may be incomplete");
  return w;
}

function buildRequiredRevisions(
  isBlocking: boolean,
  wb?: WorkBreakdownSectionContent,
  riskSec?: RiskSecuritySectionContent,
): string[] {
  const revisions: string[] = [];
  if (isBlocking) revisions.push("Resolve all blocking clarification questions before proceeding");
  if ((wb?.subtasks.length ?? 0) === 0) revisions.push("Generate work breakdown subtasks");
  if (riskSec?.securityReviewRequired && !riskSec.risks.some((r) => r.category === "security")) {
    revisions.push("Security review flagged — add security review subtask");
  }
  return revisions;
}

function buildReviewerWarnings(
  isBlocking: boolean,
  riskSec?: RiskSecuritySectionContent,
  qs?: QualityScore,
): string[] {
  const warnings: string[] = [];
  if (isBlocking) warnings.push("Clarification is required before this evaluation can be approved.");
  if (riskSec?.securityReviewRequired) warnings.push("Security review is required before distribution.");
  const highRisks = riskSec?.risks.filter((r) => r.severity === "high") ?? [];
  if (highRisks.length >= 2) {
    warnings.push(`${highRisks.length} high-severity risks require mitigation before approval.`);
  }
  if (qs && qs.overall < 50) warnings.push("Overall quality score is below 50 — significant revision required.");
  return warnings;
}

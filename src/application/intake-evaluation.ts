import type { Actor, EvaluationDepth } from "../domain/types.js";

// ─── Section Kinds ────────────────────────────────────────────────────────────

export const evaluationSectionKinds = [
  "intake_brief",
  "clarification_questions",
  "classification",
  "architecture",
  "low_code_path",
  "custom_build",
  "risk_security",
  "cost_effort",
  "work_breakdown",
  "distribution_plan",
  "synthesis",
  "quality_review",
] as const;

export type EvaluationSectionKind = (typeof evaluationSectionKinds)[number];

// ─── Depth Routing ────────────────────────────────────────────────────────────

export const EVALUATION_DEPTH_ROUTING_TABLE: Record<EvaluationDepth, EvaluationSectionKind[]> = {
  light: [
    "intake_brief",
    "classification",
    "work_breakdown",
    "synthesis",
    "quality_review",
  ],
  standard: [
    "intake_brief",
    "clarification_questions",
    "classification",
    "architecture",
    "risk_security",
    "cost_effort",
    "work_breakdown",
    "distribution_plan",
    "synthesis",
    "quality_review",
  ],
  full: [
    "intake_brief",
    "clarification_questions",
    "classification",
    "architecture",
    "low_code_path",
    "custom_build",
    "risk_security",
    "cost_effort",
    "work_breakdown",
    "distribution_plan",
    "synthesis",
    "quality_review",
  ],
};

export function getSectionKindsForDepth(depth: EvaluationDepth): EvaluationSectionKind[] {
  return EVALUATION_DEPTH_ROUTING_TABLE[depth];
}

// ─── Quality Score ────────────────────────────────────────────────────────────

export type QualityReadinessBand = "ready" | "usable" | "needs_revision" | "not_ready";

export interface QualityScore {
  dimensions: {
    completeness: number;
    consistency: number;
    specificity: number;
    feasibility: number;
    riskCoverage: number;
    handoffReadiness: number;
  };
  overall: number;
  readinessBand: QualityReadinessBand;
}

export function qualityBandFromScore(score: number): QualityReadinessBand {
  if (score >= 90) return "ready";
  if (score >= 70) return "usable";
  if (score >= 50) return "needs_revision";
  return "not_ready";
}

// ─── Section Content Types ────────────────────────────────────────────────────

export interface IntakeBriefSectionContent {
  title: string;
  requester?: string;
  source?: string;
  rawSummary: string;
  normalizedSummary: string;
  statedGoals: string[];
  successCriteria: string[];
  knownConstraints: string[];
}

export interface ClarificationQuestionsSectionContent {
  isBlocking: boolean;
  questions: Array<{
    id: string;
    question: string;
    reason: string;
    required: boolean;
    suggestedAnswerFormat?: string;
  }>;
  missingFields: string[];
}

export interface ClassificationSectionContent {
  projectType: string;
  projectSubtype?: string;
  confidence: number;
  reasoning: string;
  recommendedDepth: EvaluationDepth;
  signals: string[];
}

export interface ArchitectureSectionContent {
  recommendation: string;
  architectureStyle?: string;
  recommendedTechStack: string[];
  integrationPoints: string[];
  dataStores: string[];
  deploymentNotes: string[];
  assumptions: string[];
}

export interface LowCodePathSectionContent {
  viable: boolean;
  recommendedTools: string[];
  fitReasoning: string;
  limitations: string[];
  whenToRejectLowCode: string[];
}

export interface CustomBuildSectionContent {
  required: boolean;
  rationale: string;
  backendNeeds: string[];
  frontendNeeds: string[];
  integrationNeeds: string[];
  infrastructureNeeds: string[];
}

export interface RiskSecuritySectionContent {
  risks: Array<{
    title: string;
    severity: "low" | "medium" | "high";
    category: "security" | "privacy" | "delivery" | "technical" | "operational" | "compliance";
    mitigation: string;
  }>;
  dataSensitivity?: "unknown" | "low" | "internal" | "confidential" | "regulated";
  securityReviewRequired: boolean;
}

export interface CostEffortSectionContent {
  estimatedStoryPoints: number;
  estimatedEngineeringDays?: number;
  complexity: "low" | "medium" | "high";
  costDrivers: string[];
  costAssumptions: string[];
  infraCostSignal?: "none" | "low" | "medium" | "high" | "unknown";
}

export interface WorkBreakdownSectionContent {
  subtasks: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
    estimatedHours?: number;
    suggestedOwnerRole?: string;
  }>;
  milestones: string[];
  dependencies: string[];
}

export interface DistributionPlanSectionContent {
  monday: {
    required: boolean;
    suggestedBoard?: string;
    suggestedGroup?: string;
    itemName?: string;
    notes: string[];
  };
  github: {
    required: boolean;
    repositoryName?: string;
    issueLabels: string[];
    issueBreakdownSuggested: boolean;
  };
  dryRunOnly: true;
  distributionNotes: string[];
}

export interface SynthesisSectionContent {
  executiveSummary: string;
  recommendedPath: string;
  keyDecisions: string[];
  reviewNotes: string[];
  approvalReadinessSummary: string;
}

export interface QualityReviewSectionContent {
  qualityScore: QualityScore;
  strengths: string[];
  weaknesses: string[];
  requiredRevisions: string[];
  reviewerWarnings: string[];
}

export type EvaluationSectionContent =
  | IntakeBriefSectionContent
  | ClarificationQuestionsSectionContent
  | ClassificationSectionContent
  | ArchitectureSectionContent
  | LowCodePathSectionContent
  | CustomBuildSectionContent
  | RiskSecuritySectionContent
  | CostEffortSectionContent
  | WorkBreakdownSectionContent
  | DistributionPlanSectionContent
  | SynthesisSectionContent
  | QualityReviewSectionContent;

// ─── Provenance ───────────────────────────────────────────────────────────────

export interface EvaluationSectionProvenance {
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  agentRole: EvaluationSectionKind;
  generatedAt: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
  confidence?: number;
  warnings?: string[];
}

// ─── EvaluationSection ────────────────────────────────────────────────────────

export interface EvaluationSection<TContent = EvaluationSectionContent> {
  id: string;
  evaluationId: string;
  kind: EvaluationSectionKind;
  content: TContent;
  version: number;
  supersededById?: string;
  provenance: EvaluationSectionProvenance;
}

// ─── Evaluation Status ────────────────────────────────────────────────────────

export type IntakeEvaluationStatus =
  | "generating"
  | "clarification_required"
  | "ready_for_review"
  | "accepted"
  | "rejected"
  | "needs_revision"
  | "not_ready";

// ─── IntakeEvaluation Aggregate ───────────────────────────────────────────────

export interface IntakeEvaluation {
  id: string;
  intakeId: string;
  depth: EvaluationDepth;
  sections: EvaluationSection[];
  qualityScore?: QualityScore;
  status: IntakeEvaluationStatus;
  evaluationVersion: number;
  createdAt: string;
  createdBy: Actor;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSection<TContent extends EvaluationSectionContent>(
  evaluation: IntakeEvaluation,
  kind: EvaluationSectionKind,
): EvaluationSection<TContent> | undefined {
  return evaluation.sections.find(
    (s) => s.kind === kind && !s.supersededById,
  ) as EvaluationSection<TContent> | undefined;
}

export function assertEvaluationSectionKind(value: string): EvaluationSectionKind {
  if (!(evaluationSectionKinds as readonly string[]).includes(value)) {
    throw new Error(`Unknown EvaluationSectionKind: "${value}"`);
  }
  return value as EvaluationSectionKind;
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateEvaluationSection(section: EvaluationSection): void {
  if (!section.id || !section.id.trim()) {
    throw new Error("EvaluationSection.id is required");
  }
  if (!section.evaluationId || !section.evaluationId.trim()) {
    throw new Error("EvaluationSection.evaluationId is required");
  }
  if (!(evaluationSectionKinds as readonly string[]).includes(section.kind)) {
    throw new Error(`Unknown EvaluationSection.kind: "${section.kind}"`);
  }
  if (section.version < 1) {
    throw new Error("EvaluationSection.version must be >= 1");
  }
  if (!section.provenance || !section.provenance.agentRole) {
    throw new Error("EvaluationSection.provenance.agentRole is required");
  }
  if (!section.provenance.generatedAt) {
    throw new Error("EvaluationSection.provenance.generatedAt is required");
  }
  if (section.content === null || section.content === undefined || typeof section.content !== "object") {
    throw new Error(`EvaluationSection content for kind "${section.kind}" must be an object`);
  }
  validateSectionContentShape(section);
}

function validateSectionContentShape(section: EvaluationSection): void {
  const c = section.content as unknown as Record<string, unknown>;
  switch (section.kind) {
    case "intake_brief":
      requireString(c, "rawSummary", section.kind);
      requireString(c, "normalizedSummary", section.kind);
      break;
    case "clarification_questions":
      requireArray(c, "questions", section.kind);
      requireArray(c, "missingFields", section.kind);
      break;
    case "classification":
      requireString(c, "projectType", section.kind);
      requireString(c, "reasoning", section.kind);
      break;
    case "architecture":
      requireString(c, "recommendation", section.kind);
      requireArray(c, "recommendedTechStack", section.kind);
      break;
    case "low_code_path":
      if (typeof c["viable"] !== "boolean") throw new Error(`${section.kind}: viable must be boolean`);
      break;
    case "custom_build":
      if (typeof c["required"] !== "boolean") throw new Error(`${section.kind}: required must be boolean`);
      break;
    case "risk_security":
      requireArray(c, "risks", section.kind);
      break;
    case "cost_effort":
      if (typeof c["estimatedStoryPoints"] !== "number" || (c["estimatedStoryPoints"] as number) < 1) {
        throw new Error(`${section.kind}: estimatedStoryPoints must be a number >= 1`);
      }
      break;
    case "work_breakdown":
      requireArray(c, "subtasks", section.kind);
      break;
    case "distribution_plan":
      if (typeof c["monday"] !== "object") throw new Error(`${section.kind}: monday must be an object`);
      if (typeof c["github"] !== "object") throw new Error(`${section.kind}: github must be an object`);
      if (c["dryRunOnly"] !== true) throw new Error(`${section.kind}: dryRunOnly must be true`);
      break;
    case "synthesis":
      requireString(c, "executiveSummary", section.kind);
      requireString(c, "recommendedPath", section.kind);
      break;
    case "quality_review": {
      const qs = c["qualityScore"] as Record<string, unknown> | undefined;
      if (!qs || typeof qs !== "object") throw new Error(`${section.kind}: qualityScore must be an object`);
      const dims = qs["dimensions"] as Record<string, unknown> | undefined;
      if (!dims || typeof dims !== "object") throw new Error(`${section.kind}: qualityScore.dimensions must be an object`);
      validateQualityDimensions(dims, section.kind);
      validateQualityOverall(qs, section.kind);
      break;
    }
  }
}

function requireString(c: Record<string, unknown>, key: string, kind: string): void {
  if (typeof c[key] !== "string" || !(c[key] as string).trim()) {
    throw new Error(`${kind}: ${key} must be a non-empty string`);
  }
}

function requireArray(c: Record<string, unknown>, key: string, kind: string): void {
  if (!Array.isArray(c[key])) {
    throw new Error(`${kind}: ${key} must be an array`);
  }
}

function validateQualityDimensions(dims: Record<string, unknown>, kind: string): void {
  const keys = ["completeness", "consistency", "specificity", "feasibility", "riskCoverage", "handoffReadiness"];
  for (const k of keys) {
    const v = dims[k];
    if (typeof v !== "number" || v < 0 || v > 100) {
      throw new Error(`${kind}: qualityScore.dimensions.${k} must be a number between 0 and 100`);
    }
  }
}

function validateQualityOverall(qs: Record<string, unknown>, kind: string): void {
  const overall = qs["overall"];
  if (typeof overall !== "number" || overall < 0 || overall > 100) {
    throw new Error(`${kind}: qualityScore.overall must be a number between 0 and 100`);
  }
  const band = qs["readinessBand"];
  const expected = qualityBandFromScore(overall as number);
  if (band !== expected) {
    throw new Error(`${kind}: qualityScore.readinessBand "${band}" does not match score ${overall} (expected "${expected}")`);
  }
}

export function validateIntakeEvaluation(evaluation: IntakeEvaluation): void {
  if (!evaluation.id || !evaluation.id.trim()) throw new Error("IntakeEvaluation.id is required");
  if (!evaluation.intakeId || !evaluation.intakeId.trim()) throw new Error("IntakeEvaluation.intakeId is required");
  if (!["light", "standard", "full"].includes(evaluation.depth)) {
    throw new Error(`IntakeEvaluation.depth "${evaluation.depth}" is invalid`);
  }
  if (evaluation.evaluationVersion < 1) throw new Error("IntakeEvaluation.evaluationVersion must be >= 1");

  // Check for duplicate active section kinds
  const activeSections = evaluation.sections.filter((s) => !s.supersededById);
  const activeSectionKinds = activeSections.map((s) => s.kind);
  const kindSet = new Set(activeSectionKinds);
  if (kindSet.size !== activeSectionKinds.length) {
    const duplicates = activeSectionKinds.filter((k, i) => activeSectionKinds.indexOf(k) !== i);
    throw new Error(`IntakeEvaluation has duplicate active sections: ${[...new Set(duplicates)].join(", ")}`);
  }

  for (const section of evaluation.sections) {
    validateEvaluationSection(section);
  }

  if (evaluation.qualityScore) {
    const dims = evaluation.qualityScore.dimensions;
    validateQualityDimensions(dims as unknown as Record<string, unknown>, "evaluation.qualityScore");
    validateQualityOverall(evaluation.qualityScore as unknown as Record<string, unknown>, "evaluation.qualityScore");
  }
}

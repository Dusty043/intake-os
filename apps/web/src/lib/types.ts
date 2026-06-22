// ─── Evaluation types ────────────────────────────────────────────────────────

export type EvaluationDepth = "light" | "standard" | "full";

export type EvaluationSectionKind =
  | "intake_brief"
  | "clarification_questions"
  | "classification"
  | "architecture"
  | "low_code_path"
  | "custom_build"
  | "risk_security"
  | "cost_effort"
  | "work_breakdown"
  | "distribution_plan"
  | "synthesis"
  | "quality_review";

export type IntakeEvaluationStatus =
  | "generating"
  | "clarification_required"
  | "ready_for_review"
  | "accepted"
  | "rejected"
  | "needs_revision"
  | "not_ready";

export type QualityReadinessBand = "ready" | "usable" | "needs_revision" | "not_ready";

export type QualityScore = {
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
};

export type EvaluationSectionProvenance = {
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
};

export type EvaluationSection = {
  id: string;
  evaluationId: string;
  kind: EvaluationSectionKind;
  content: Record<string, unknown>;
  version: number;
  supersededById?: string;
  provenance: EvaluationSectionProvenance;
};

export type IntakeEvaluation = {
  id: string;
  intakeId: string;
  depth: EvaluationDepth;
  sections: EvaluationSection[];
  qualityScore?: QualityScore;
  status: IntakeEvaluationStatus;
  evaluationVersion: number;
  createdAt: string;
  createdBy: { id: string; role: string; displayName?: string };
};

export type AgentRun = {
  id: string;
  evaluationId: string;
  sectionId?: string;
  agentRole: EvaluationSectionKind;
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
  finishReason?: string;
  status: "success" | "failed" | "skipped";
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type EvaluationSummary = {
  id: string;
  intakeId: string;
  depth: EvaluationDepth;
  status: IntakeEvaluationStatus;
  evaluationVersion: number;
  createdAt: string;
  createdBy: { id: string; name?: string; role: string };
  qualityScore?: QualityScore;
  sectionKinds: EvaluationSectionKind[];
};

// ─── Actor roles ─────────────────────────────────────────────────────────────

export type ActorRole =
  | "request_creator"
  | "intake_owner"
  | "devops_lead"
  | "admin"
  | "developer";

export type UiActor = {
  id: string;
  name: string;
  role: ActorRole;
};

export type PendingClarificationQuestion = {
  id: string;
  question: string;
  required: boolean;
  reason?: string;
};

export type ProjectIntakeRecord = {
  id: string;
  title: string;
  description?: string;
  requester?: string;
  department?: string;
  projectType?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  analysisDrafts?: IntakeAnalysisDraft[];
  latestAnalysisDraft?: IntakeAnalysisDraft;
  reviewedProjectPackage?: ReviewedProjectPackage;
  provisioningPlan?: ProvisioningPlan;
  approvals?: ApprovalRecord;
  source?: { system?: string; externalId?: string };
  pendingClarification?: {
    questions: PendingClarificationQuestion[];
    missingFields: string[];
  };
  priorClarifications?: Array<{ question: string; answer: string }>;
  lifecycleNote?: string;
  blockedReason?: string;
  blockedAt?: string;
  unblockedAt?: string;
  completedAt?: string;
  completedNote?: string;
  canceledAt?: string;
  canceledReason?: string;
  archivedAt?: string;
  externalLinks?: Array<{ provider: string; externalId: string; url?: string; label?: string; createdAt: string }>;
  [key: string]: unknown;
};

export type IntakeAnalysisDraft = {
  id: string;
  intakeId?: string;
  reviewStatus?: string;
  provider?: string;
  model?: string;
  projectType?: string;
  complexity?: string;
  estimatedStoryPoints?: number;
  confidence?: number;
  recommendedTechStack?: string[];
  infrastructureRequirements?: string[];
  brief?: {
    problem?: string;
    solution?: string;
    scope?: string[];
    outOfScope?: string[];
  };
  subtasks?: Array<{
    title: string;
    description?: string;
    storyPoints?: number;
  }>;
  assignmentRecommendation?: unknown;
  missingInformation?: string[];
  warnings?: string[];
  proposedArchitecture?: string;
  implementationSuggestions?: string[];
  definitionOfDone?: string;
  openQuestions?: Array<{ question: string; askedOf: string; blocking: boolean }>;
  keyDependencies?: Array<{ item: string; reason: string; blocking: boolean }>;
  createdAt?: string;
  generatedAt?: string;
  [key: string]: unknown;
};

export type ReviewedProjectPackage = {
  id: string;
  sourceDraftId?: string;
  intakeId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewDecision?: "accepted" | "revised" | string;
  reviewerNotes?: string;
  projectType?: string;
  complexity?: string;
  estimatedStoryPoints?: number;
  recommendedTechStack?: string[];
  infrastructureRequirements?: string[];
  brief?: {
    problem?: string;
    solution?: string;
    scope?: string[];
    outOfScope?: string[];
  };
  subtasks?: Array<{
    title: string;
    description?: string;
    storyPoints?: number;
  }>;
  assignmentRecommendation?: unknown;
  missingInformation?: string[];
  [key: string]: unknown;
};

export type ApprovalRecord = {
  gate_1?: { status: string; actorId?: string; actorName?: string; comment?: string; completedAt?: string };
  gate_2?: { status: string; actorId?: string; actorName?: string; comment?: string; completedAt?: string };
  [key: string]: unknown;
};

export type ProvisioningPlan = {
  id: string;
  intakeId?: string;
  status?: string;
  projectType?: string;
  source?: {
    type?: string;
    sourceId?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  validation?: { valid?: boolean; errors?: string[] };
  actions?: ProvisioningPlanAction[];
  generatedAt?: string;
  [key: string]: unknown;
};

export type ProvisioningPlanAction = {
  id?: string;
  system?: string;
  provider?: string;
  action?: string;
  name?: string;
  description?: string;
  dryRun?: boolean;
  idempotencyKey?: string;
  payload?: unknown;
  [key: string]: unknown;
};

export type ProvisioningTargetResult = {
  id: string;
  targetKind: string;
  status: "pending" | "succeeded" | "failed" | "skipped";
  idempotencyKey: string;
  externalId?: string;
  externalUrl?: string;
  errorMessage?: string;
  errorCategory?: string;
  attemptCount: number;
  retryable: boolean;
  deadLettered?: boolean;
  deadLetteredAt?: string;
  completedAt?: string;
};

export type ProvisioningRun = {
  id: string;
  intakeId: string;
  planId: string;
  status: "executing" | "completed" | "failed" | "partial_success";
  kind: "initial" | "retry";
  retryOfRunId?: string;
  triggeredById: string;
  triggeredByRole: string;
  triggeredByName?: string;
  startedAt: string;
  completedAt?: string;
  errorSummary?: string;
  targets: ProvisioningTargetResult[];
};

export type AuditEvent = {
  id?: string;
  requestId?: string;
  intakeId?: string;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  action?: string;
  fromState?: string;
  toState?: string;
  reason?: string;
  metadata?: unknown;
  timestamp?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type ReviseAnalysisDraftInput = {
  projectType?: string;
  complexity?: string;
  estimatedStoryPoints?: number;
  recommendedTechStack?: string[];
  infrastructureRequirements?: string[];
  brief?: {
    problem?: string;
    solution?: string;
    scope?: string[];
    outOfScope?: string[];
  };
  subtasks?: Array<{ title: string; description?: string; storyPoints?: number }>;
  missingInformation?: string[];
  reviewerNotes?: string;
};

export type CreateIntakeInput = {
  title: string;
  description: string;
  requester: string;
  department?: string;
  projectType: string;
};

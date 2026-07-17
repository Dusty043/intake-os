import type {
  Actor,
  ApprovalGate,
  AuditEvent,
  DistributionMode,
  EvaluationDepth,
  GitHubRequirement,
  ProjectRequestSnapshot,
  ProjectType,
  RequestStatus,
} from "../domain/types.js";
import type { RepositoryNameResult } from "../domain/repository-naming.js";
import type { GenerateMockAnalysisDraftInput, IntakeAnalysisDraft } from "./intake-analysis.js";

export type AnalysisDraftReviewDecision = "accepted" | "revised";

export interface ReviewedProjectPackageBrief {
  problem: string;
  solution: string;
  scope: readonly string[];
  outOfScope: readonly string[];
}

export interface ReviewedProjectPackageSubtask {
  title: string;
  description: string;
  storyPoints: number;
}

export interface ReviewedProjectPackage {
  id: string;
  /** Set when the package was reviewed from a single-call-provider draft (legacy engine). */
  sourceDraftId?: string;
  /** Set when the package was reviewed directly from an orchestrator evaluation (source of truth). Exactly one of sourceDraftId/sourceEvaluationId is present. */
  sourceEvaluationId?: string;
  intakeId: string;
  reviewedBy: string;
  reviewedAt: string;
  reviewDecision: AnalysisDraftReviewDecision;
  reviewerNotes?: string;
  projectType: ProjectType;
  complexity: "low" | "medium" | "high";
  estimatedStoryPoints: number;
  recommendedTechStack: readonly string[];
  infrastructureRequirements: readonly string[];
  brief: ReviewedProjectPackageBrief;
  subtasks: readonly ReviewedProjectPackageSubtask[];
  assignmentRecommendation?: {
    recommendedDeveloperId?: string;
    recommendedDeveloperName?: string;
    reason: string;
    confidence: number;
  };
  missingInformation: readonly string[];
}

export interface ReviewedProjectPackageInput {
  projectType: ProjectType;
  complexity: "low" | "medium" | "high";
  estimatedStoryPoints: number;
  recommendedTechStack: readonly string[];
  infrastructureRequirements: readonly string[];
  brief: ReviewedProjectPackageBrief;
  subtasks: readonly ReviewedProjectPackageSubtask[];
  assignmentRecommendation?: {
    recommendedDeveloperId?: string;
    recommendedDeveloperName?: string;
    reason: string;
    confidence: number;
  };
  missingInformation: readonly string[];
}

export interface AcceptAnalysisDraftInput {
  intakeId: string;
  /** Omit on the orchestrator path — the latest ready-for-review evaluation is used instead. */
  draftId?: string;
  reviewerNotes?: string;
}

export interface RejectAnalysisDraftInput {
  intakeId: string;
  draftId?: string;
  reason: string;
}

export interface ReviseAnalysisDraftInput {
  intakeId: string;
  draftId?: string;
  reviewedPackage: ReviewedProjectPackageInput;
  reviewerNotes?: string;
}

export const intakeSourceSystems = ["manual", "bitrix24", "monday", "email", "other"] as const;

export type IntakeSourceSystem = (typeof intakeSourceSystems)[number];

export interface IntakeSourceReference {
  system: IntakeSourceSystem;
  externalId?: string;
  externalUrl?: string;
  rawPayload?: Record<string, unknown>;
}

export interface ExternalLinkRecord {
  provider: "bitrix24" | "github" | "monday" | "other";
  externalId: string;
  url?: string;
  label?: string;
  createdAt: string;
}

export type DataSensitivity = "unknown" | "low" | "medium" | "high";
export type ComplexityEstimate = "unknown" | "low" | "medium" | "high";

export interface DiscoveryRecord {
  problemStatement: string;
  stakeholders: readonly string[];
  expectedUsers: readonly string[];
  systemsTouched: readonly string[];
  dataSensitivity: DataSensitivity;
  infraNeeds: readonly string[];
  estimatedComplexity: ComplexityEstimate;
  requiresGithub?: boolean;
  requiresMonday?: boolean;
  relatedToBitrix24?: boolean;
  notes?: string;
  completedBy: Actor;
  completedAt: string;
}

export type ProvisioningPlanStatus = "draft" | "ready_for_provisioning";

export type DistributionSourceType =
  | "reviewed_project_package"
  | "manual_discovery"
  | "legacy_intake_record";

export interface ProvisioningPlanSource {
  type: DistributionSourceType;
  sourceId: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type ProvisioningActionSystem = "github" | "monday" | "bitrix24" | "docs" | "manual";

export type ProvisioningActionName =
  | "create_repository"
  | "create_default_labels"
  | "create_initial_issues"
  | "create_board"
  | "create_handoff_doc"
  | "update_origin_record"
  | "manual_review";

export interface ProvisioningPlanAction {
  id: string;
  system: ProvisioningActionSystem;
  action: ProvisioningActionName;
  description: string;
  dryRun: true;
  requiresCredential: boolean;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

export interface ProvisioningPlanValidation {
  valid: boolean;
  errors: readonly string[];
}

export interface ProvisioningPlan {
  id: string;
  intakeId: string;
  projectName: string;
  projectType: ProjectType;
  status: ProvisioningPlanStatus;
  generatedAt: string;
  generatedBy: Actor;
  source: ProvisioningPlanSource;
  repository?: RepositoryNameResult;
  githubRequirement: GitHubRequirement;
  evaluationDepth: EvaluationDepth;
  distributionMode: DistributionMode;
  actions: readonly ProvisioningPlanAction[];
  validation: ProvisioningPlanValidation;
  approvedForExecutionAt?: string;
  approvedForExecutionBy?: Actor;
}

export interface PendingClarificationQuestion {
  id: string;
  question: string;
  required: boolean;
  reason?: string;
}

export interface PriorClarification {
  question: string;
  answer: string;
}

export interface ProjectIntakeRecord extends ProjectRequestSnapshot {
  id: string;
  title: string;
  description: string;
  requester: string;
  department?: string;
  projectType: ProjectType;
  source: IntakeSourceReference;
  status: RequestStatus;
  createdAt: string;
  createdBy: Actor;
  discovery?: DiscoveryRecord;
  analysisDrafts?: readonly IntakeAnalysisDraft[];
  latestAnalysisDraft?: IntakeAnalysisDraft;
  analysisDraftRegenerationCount?: number;
  reviewedProjectPackage?: ReviewedProjectPackage;
  provisioningPlan?: ProvisioningPlan;
  externalLinks: readonly ExternalLinkRecord[];
  pendingClarification?: {
    questions: readonly PendingClarificationQuestion[];
    missingFields: readonly string[];
  };
  priorClarifications?: readonly PriorClarification[];

  // Developer assignment override — set manually, takes precedence over AI recommendation
  assignmentOverride?: {
    developerId?: string;
    developerName: string;
    reason: string;
    overriddenAt: string;
    overriddenBy: Actor;
  };

  // Post-distribution lifecycle metadata (all optional — only set after distribution)
  lifecycleNote?: string;
  blockedReason?: string;
  blockedAt?: string;
  unblockedAt?: string;
  completedAt?: string;
  completedNote?: string;
  canceledAt?: string;
  canceledReason?: string;
  archivedAt?: string;
}

export interface RegenerateAnalysisDraftInput {
  guidance: string;
  requestedBy: string;
}

export interface CreateIntakeInput {
  title: string;
  description: string;
  requester: string;
  department?: string;
  projectType: ProjectType;
  source?: IntakeSourceReference;
}

export interface CompleteDiscoveryInput {
  problemStatement: string;
  stakeholders?: readonly string[];
  expectedUsers?: readonly string[];
  systemsTouched?: readonly string[];
  dataSensitivity?: DataSensitivity;
  infraNeeds?: readonly string[];
  estimatedComplexity?: ComplexityEstimate;
  requiresGithub?: boolean;
  requiresMonday?: boolean;
  relatedToBitrix24?: boolean;
  notes?: string;
}

export interface GenerateProvisioningPlanInput {
  teamPrefix: string;
  existingRepositoryNames?: readonly string[];
  overrideRepositoryName?: string;
  overrideReason?: string;
  includeMondayBoard?: boolean;
  intakeRecordUrl?: string;
}

export interface GenerateEvaluationInput {
  depth?: EvaluationDepth;
  provider?: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  allowDepthUpgrade?: boolean;
}

export interface ApprovalDecisionInput {
  gate?: ApprovalGate;
  comment?: string;
}

export type { GenerateMockAnalysisDraftInput };

export type { AgentRunRecord, EvaluationPersistenceBundle } from "./evaluation-persistence.js";
import type { AgentRunRecord, EvaluationPersistenceBundle } from "./evaluation-persistence.js";
import type { IntakeEvaluation } from "./intake-evaluation.js";
import type { ProvisioningRun, ProvisioningTargetResult } from "../domain/provisioning.js";

export type { ProvisioningRun } from "../domain/provisioning.js";
export type { ProvisioningTargetResult } from "../domain/provisioning.js";
export type { ProvisioningRunStatus, ProvisioningTargetStatus, ProvisioningTargetKind } from "../domain/provisioning.js";

export interface ProjectIntakeStore {
  listIntakes(pagination?: { take?: number; skip?: number }): Promise<readonly ProjectIntakeRecord[]>;
  getIntake(id: string): Promise<ProjectIntakeRecord | null>;
  saveIntake(record: ProjectIntakeRecord): Promise<ProjectIntakeRecord>;
  // Compare-and-swap variant (Q-CONC-1): only writes if the stored row's `updatedAt`
  // still matches `expectedUpdatedAt` (i.e. nothing else wrote to this intake between
  // the caller's read and this write). Returns null on conflict instead of throwing,
  // so the caller can re-read and retry. A brand-new record (no existing row) always
  // succeeds since there's nothing to conflict with.
  saveIntake(record: ProjectIntakeRecord, options: { expectedUpdatedAt: string }): Promise<ProjectIntakeRecord | null>;
  listAuditEvents(intakeId: string): Promise<readonly AuditEvent[]>;
  appendAuditEvent(event: AuditEvent): Promise<AuditEvent>;

  saveEvaluation(bundle: EvaluationPersistenceBundle): Promise<void>;
  getEvaluation(intakeId: string, evaluationId: string): Promise<IntakeEvaluation | undefined>;
  listEvaluationsForIntake(intakeId: string): Promise<IntakeEvaluation[]>;
  getLatestEvaluationForIntake(intakeId: string): Promise<IntakeEvaluation | undefined>;
  listAgentRuns(evaluationId: string): Promise<AgentRunRecord[]>;
  listAllAgentRuns(filters?: { intakeId?: string; startDate?: string; endDate?: string }): Promise<Array<AgentRunRecord & { intakeId: string }>>;
  getEvaluationById?(evaluationId: string): Promise<IntakeEvaluation | undefined>;

  saveProvisioningRun(run: ProvisioningRun): Promise<ProvisioningRun>;
  listProvisioningRuns(intakeId: string): Promise<ProvisioningRun[]>;
  getProvisioningRun(intakeId: string, runId: string): Promise<ProvisioningRun | undefined>;
  updateProvisioningTargetResult(targetId: string, updates: Partial<ProvisioningTargetResult>): Promise<void>;
  // Atomically checks "no run for this intake is currently executing" and inserts `run` as
  // a single store operation, closing the TOCTOU window that existed when callers did
  // listProvisioningRuns() then saveProvisioningRun() as two separate round trips. Returns
  // null if a run for run.intakeId is already "executing" (caller should surface a
  // ConflictError). A Postgres/Prisma-backed implementation must enforce this with a
  // transaction (SELECT ... FOR UPDATE, or a partial unique index on (intakeId) WHERE
  // status = 'executing') — an in-memory implementation gets it "for free" only because it
  // can do the check-and-insert without an internal `await`.
  createProvisioningRunIfNoneExecuting(run: ProvisioningRun): Promise<ProvisioningRun | null>;
}

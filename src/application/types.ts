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
  sourceDraftId: string;
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
  draftId: string;
  reviewerNotes?: string;
}

export interface RejectAnalysisDraftInput {
  intakeId: string;
  draftId: string;
  reason: string;
}

export interface ReviseAnalysisDraftInput {
  intakeId: string;
  draftId: string;
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

export interface ApprovalDecisionInput {
  gate?: ApprovalGate;
  comment?: string;
}

export type { GenerateMockAnalysisDraftInput };

export type { AgentRunRecord, EvaluationPersistenceBundle } from "./evaluation-persistence.js";
import type { AgentRunRecord, EvaluationPersistenceBundle } from "./evaluation-persistence.js";
import type { IntakeEvaluation } from "./intake-evaluation.js";

export interface ProjectIntakeStore {
  listIntakes(): Promise<readonly ProjectIntakeRecord[]>;
  getIntake(id: string): Promise<ProjectIntakeRecord | null>;
  saveIntake(record: ProjectIntakeRecord): Promise<ProjectIntakeRecord>;
  listAuditEvents(intakeId: string): Promise<readonly AuditEvent[]>;
  appendAuditEvent(event: AuditEvent): Promise<AuditEvent>;

  saveEvaluation(bundle: EvaluationPersistenceBundle): Promise<void>;
  getEvaluation(intakeId: string, evaluationId: string): Promise<IntakeEvaluation | undefined>;
  listEvaluationsForIntake(intakeId: string): Promise<IntakeEvaluation[]>;
  getLatestEvaluationForIntake(intakeId: string): Promise<IntakeEvaluation | undefined>;
  listAgentRuns(evaluationId: string): Promise<AgentRunRecord[]>;
  getEvaluationById?(evaluationId: string): Promise<IntakeEvaluation | undefined>;
}

export const requestStatuses = [
  "draft",
  "submitted",
  "evaluating",
  "clarification_required",
  "intake_review",
  "devops_review",
  "approved",
  "provisioning",
  "distributed",
  "provisioning_failed",
  "archived",
  "in_progress",
  "blocked",
  "completed",
  "canceled",
] as const;

export type RequestStatus = (typeof requestStatuses)[number];

export const workflowActions = [
  "submit",
  "generate_evaluation",
  "request_clarification",
  "cancel_request",
  "success",
  "clarification_needed",
  "cancel_evaluation",
  "evaluation_failed",
  "resubmit",
  "approve",
  "reject",
  "request_changes",
  "start_provisioning",
  "archive",
  "failure",
  "cancel_remaining",
  "retry",
  "restore",
] as const;

export type WorkflowAction = (typeof workflowActions)[number];

export const approvalGates = ["gate_1", "gate_2"] as const;

export type ApprovalGate = (typeof approvalGates)[number];

export const approvalStatuses = ["approved"] as const;

export type ApprovalStatus = (typeof approvalStatuses)[number];

export const userRoles = [
  "request_creator",
  "intake_owner",
  "devops_lead",
  "developer",
  "admin",
] as const;

export type UserRole = (typeof userRoles)[number];

export interface Actor {
  id: string;
  role: UserRole;
  displayName?: string;
}

export interface ApprovalRecord {
  gate: ApprovalGate;
  status: ApprovalStatus;
  actorId: string;
  actorRole: UserRole;
  completedAt: string;
  locked: true;
  reason?: string;
}

export interface DistributionPackageState {
  validated: boolean;
  validationId?: string;
  validatedAt?: string;
}

export interface ExternalResourceReference {
  provider: "monday" | "github" | "other";
  externalId: string;
  idempotencyKey: string;
  url?: string;
}

export interface ProjectRequestSnapshot {
  id: string;
  status: RequestStatus;
  approvals?: Partial<Record<ApprovalGate, ApprovalRecord>>;
  distributionPackage?: DistributionPackageState;
  externalResources?: ExternalResourceReference[];
  updatedAt?: string;
}

export interface AuditEvent {
  requestId: string;
  actorId: string;
  actorRole: UserRole;
  action: WorkflowAction | string;
  fromState?: RequestStatus;
  toState?: RequestStatus;
  timestamp: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export const projectTypes = [
  "n8n_automation",
  "data_sync_integration",
  "internal_dashboard",
  "internal_tool",
  "client_portal",
  "saas_platform",
  "api_service",
  "ai_workflow_tool",
  "discovery_research",
  "reporting_automation",
] as const;

export type ProjectType = (typeof projectTypes)[number];

export const githubRequirements = ["yes", "no", "optional"] as const;

export type GitHubRequirement = (typeof githubRequirements)[number];

export const evaluationDepths = ["light", "standard", "full"] as const;

export type EvaluationDepth = (typeof evaluationDepths)[number];

export const distributionModes = ["none", "B", "C", "B_or_C"] as const;

export type DistributionMode = (typeof distributionModes)[number];

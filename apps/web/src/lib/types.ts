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

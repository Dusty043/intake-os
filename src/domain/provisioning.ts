export const provisioningRunStatuses = [
  "executing",
  "completed",
  "failed",
  "partial_success",
] as const;

export type ProvisioningRunStatus = (typeof provisioningRunStatuses)[number];

export const provisioningTargetStatuses = [
  "pending",
  "succeeded",
  "failed",
  "skipped",
] as const;

export type ProvisioningTargetStatus = (typeof provisioningTargetStatuses)[number];

export const provisioningTargetKinds = [
  "monday_project_item",
  "github_repo",
  "github_issues",
  "google_chat_notification",
] as const;

export type ProvisioningTargetKind = (typeof provisioningTargetKinds)[number];

export const provisioningRunKinds = ["initial", "retry"] as const;
export type ProvisioningRunKind = (typeof provisioningRunKinds)[number];

export interface ProvisioningTargetResult {
  id: string;
  runId: string;
  targetKind: ProvisioningTargetKind;
  status: ProvisioningTargetStatus;
  idempotencyKey: string;
  externalId?: string;
  externalUrl?: string;
  errorMessage?: string;
  attemptCount: number;
  retryable: boolean;
  completedAt?: string;
}

export interface ProvisioningRun {
  id: string;
  intakeId: string;
  planId: string;
  status: ProvisioningRunStatus;
  kind: ProvisioningRunKind;
  retryOfRunId?: string;
  triggeredById: string;
  triggeredByRole: string;
  triggeredByName?: string;
  startedAt: string;
  completedAt?: string;
  targets: ProvisioningTargetResult[];
}

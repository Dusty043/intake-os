import type {
  Actor,
  ApprovalGate,
  ApprovalRecord,
  AuditEvent,
  ProjectRequestSnapshot,
  RequestStatus,
  WorkflowAction,
} from "./types.js";

export interface WorkflowTransition {
  from: RequestStatus;
  action: WorkflowAction;
  to: RequestStatus;
}

export interface WorkflowTransitionOptions {
  now?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowTransitionResult {
  request: ProjectRequestSnapshot;
  auditEvent: AuditEvent;
}

export class InvalidTransitionError extends Error {
  constructor(from: RequestStatus, action: WorkflowAction) {
    super(`Invalid workflow transition: ${from} -> ${action}`);
    this.name = "InvalidTransitionError";
  }
}

export class WorkflowGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowGuardError";
  }
}

export const workflowTransitions: readonly WorkflowTransition[] = [
  { from: "draft", action: "submit", to: "submitted" },
  { from: "submitted", action: "generate_evaluation", to: "evaluating" },
  { from: "submitted", action: "request_clarification", to: "clarification_required" },
  { from: "submitted", action: "cancel_request", to: "archived" },
  { from: "evaluating", action: "success", to: "intake_review" },
  { from: "evaluating", action: "clarification_needed", to: "clarification_required" },
  { from: "evaluating", action: "cancel_evaluation", to: "submitted" },
  { from: "evaluating", action: "evaluation_failed", to: "submitted" },
  { from: "clarification_required", action: "resubmit", to: "submitted" },
  { from: "intake_review", action: "approve", to: "devops_review" },
  { from: "intake_review", action: "request_clarification", to: "clarification_required" },
  { from: "intake_review", action: "reject", to: "archived" },
  { from: "devops_review", action: "approve", to: "approved" },
  { from: "devops_review", action: "reject", to: "archived" },
  { from: "devops_review", action: "request_changes", to: "intake_review" },
  { from: "approved", action: "start_provisioning", to: "provisioning" },
  { from: "approved", action: "archive", to: "archived" },
  { from: "provisioning", action: "success", to: "distributed" },
  { from: "provisioning", action: "failure", to: "provisioning_failed" },
  { from: "provisioning", action: "cancel_remaining", to: "provisioning_failed" },
  { from: "provisioning_failed", action: "retry", to: "provisioning" },
  { from: "provisioning_failed", action: "archive", to: "archived" },
  { from: "distributed", action: "archive", to: "archived" },
  { from: "archived", action: "restore", to: "draft" },
];

export function getNextStatus(
  from: RequestStatus,
  action: WorkflowAction,
): RequestStatus | null {
  return workflowTransitions.find(
    (transition) => transition.from === from && transition.action === action,
  )?.to ?? null;
}

export function canTransitionStatus(
  from: RequestStatus,
  action: WorkflowAction,
): boolean {
  return getNextStatus(from, action) !== null;
}

export function assertTransition(
  from: RequestStatus,
  action: WorkflowAction,
): RequestStatus {
  const nextStatus = getNextStatus(from, action);

  if (!nextStatus) {
    throw new InvalidTransitionError(from, action);
  }

  return nextStatus;
}

export function isApprovalComplete(
  request: ProjectRequestSnapshot,
  gate: ApprovalGate,
): boolean {
  return request.approvals?.[gate]?.status === "approved";
}

export function areBothApprovalGatesComplete(
  request: ProjectRequestSnapshot,
): boolean {
  return isApprovalComplete(request, "gate_1") && isApprovalComplete(request, "gate_2");
}

export function isDistributionPackageValidated(
  request: ProjectRequestSnapshot,
): boolean {
  return request.distributionPackage?.validated === true;
}

export function canStartProvisioning(request: ProjectRequestSnapshot): boolean {
  return (
    request.status === "approved" &&
    areBothApprovalGatesComplete(request) &&
    isDistributionPackageValidated(request)
  );
}

export function applyWorkflowTransition(
  request: ProjectRequestSnapshot,
  action: WorkflowAction,
  actor: Actor,
  options: WorkflowTransitionOptions = {},
): WorkflowTransitionResult {
  const fromState = request.status;
  const toState = assertTransition(fromState, action);
  const timestamp = options.now ?? new Date().toISOString();
  const approvals = { ...(request.approvals ?? {}) };

  if (fromState === "intake_review" && action === "approve") {
    ensureApprovalRecordCanBeCreated(approvals.gate_1, "gate_1");
    approvals.gate_1 = createApprovalRecord("gate_1", actor, timestamp, options.reason);
  }

  if (fromState === "devops_review" && action === "approve") {
    if (!isApprovalComplete({ ...request, approvals }, "gate_1")) {
      throw new WorkflowGuardError("Gate 2 approval is blocked until Gate 1 is complete.");
    }

    ensureApprovalRecordCanBeCreated(approvals.gate_2, "gate_2");
    approvals.gate_2 = createApprovalRecord("gate_2", actor, timestamp, options.reason);
  }

  if (fromState === "approved" && action === "start_provisioning") {
    if (!canStartProvisioning({ ...request, approvals })) {
      throw new WorkflowGuardError(
        "Provisioning is blocked until Gate 1, Gate 2, approved state, and distribution package validation are all complete.",
      );
    }
  }

  const auditEvent: AuditEvent = {
    requestId: request.id,
    actorId: actor.id,
    actorRole: actor.role,
    action,
    fromState,
    toState,
    timestamp,
  };

  if (options.reason) {
    auditEvent.reason = options.reason;
  }

  if (options.metadata) {
    auditEvent.metadata = options.metadata;
  }

  return {
    request: {
      ...request,
      status: toState,
      approvals,
      updatedAt: timestamp,
    },
    auditEvent,
  };
}

function createApprovalRecord(
  gate: ApprovalGate,
  actor: Actor,
  completedAt: string,
  reason?: string,
): ApprovalRecord {
  const record: ApprovalRecord = {
    gate,
    status: "approved",
    actorId: actor.id,
    actorRole: actor.role,
    completedAt,
    locked: true,
  };

  if (reason) {
    record.reason = reason;
  }

  return record;
}

function ensureApprovalRecordCanBeCreated(
  existingRecord: ApprovalRecord | undefined,
  gate: ApprovalGate,
): void {
  if (existingRecord?.locked) {
    throw new WorkflowGuardError(`${gate} approval records are immutable after completion.`);
  }
}

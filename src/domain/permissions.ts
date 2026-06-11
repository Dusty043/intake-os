import type { Actor, ProjectRequestSnapshot, UserRole } from "./types.js";
import { canStartProvisioning, isApprovalComplete } from "./workflow.js";

export const permissionActions = [
  "create_request",
  "edit_draft",
  "submit_request",
  "generate_evaluation",
  "review_analysis_draft",
  "steer_analysis_draft",
  "approve_gate_1",
  "approve_gate_2",
  "trigger_provisioning",
  "retry_provisioning",
  "view_audit_logs",
  "manage_integrations",
] as const;

export type PermissionAction = (typeof permissionActions)[number];

export type AuditVisibility = "own" | "assigned" | "operational" | "none" | "full";

const permissionMatrix: Record<UserRole, readonly PermissionAction[]> = {
  request_creator: ["create_request", "edit_draft", "submit_request", "view_audit_logs"],
  intake_owner: [
    "create_request",
    "edit_draft",
    "submit_request",
    "generate_evaluation",
    "review_analysis_draft",
    "steer_analysis_draft",
    "approve_gate_1",
    "view_audit_logs",
  ],
  devops_lead: [
    "create_request",
    "edit_draft",
    "submit_request",
    "generate_evaluation",
    "review_analysis_draft",
    "steer_analysis_draft",
    "approve_gate_1",
    "approve_gate_2",
    "trigger_provisioning",
    "retry_provisioning",
    "view_audit_logs",
  ],
  developer: [],
  admin: [
    "create_request",
    "edit_draft",
    "submit_request",
    "generate_evaluation",
    "review_analysis_draft",
    "steer_analysis_draft",
    "approve_gate_1",
    "approve_gate_2",
    "trigger_provisioning",
    "retry_provisioning",
    "view_audit_logs",
    "manage_integrations",
  ],
};

export function getPermittedActions(role: UserRole): readonly PermissionAction[] {
  return permissionMatrix[role];
}

export function hasPermission(
  roles: UserRole | readonly UserRole[],
  action: PermissionAction,
): boolean {
  const roleList: readonly UserRole[] = Array.isArray(roles) ? roles : [roles];
  return roleList.some((role) => permissionMatrix[role].includes(action));
}

export function canApproveGate1(actor: Actor): boolean {
  return hasPermission(actor.role, "approve_gate_1");
}

export function canApproveGate2(actor: Actor, request: ProjectRequestSnapshot): boolean {
  return hasPermission(actor.role, "approve_gate_2") && isApprovalComplete(request, "gate_1");
}

export function canTriggerProvisioning(actor: Actor, request: ProjectRequestSnapshot): boolean {
  return hasPermission(actor.role, "trigger_provisioning") && canStartProvisioning(request);
}

export function canRetryProvisioning(actor: Actor, request: ProjectRequestSnapshot): boolean {
  return hasPermission(actor.role, "retry_provisioning") && request.status === "provisioning_failed";
}

export function auditVisibilityForRole(role: UserRole): AuditVisibility {
  switch (role) {
    case "request_creator":
      return "own";
    case "intake_owner":
      return "assigned";
    case "devops_lead":
      return "operational";
    case "developer":
      return "none";
    case "admin":
      return "full";
  }
}

export function overrideRequiresReason(action: string): boolean {
  return action.includes("override") || action.includes("restore") || action.includes("reprovision");
}

export function validateOverrideReason(action: string, reason: string | null | undefined): {
  valid: boolean;
  reasonRequired: boolean;
} {
  const reasonRequired = overrideRequiresReason(action);
  return {
    reasonRequired,
    valid: !reasonRequired || Boolean(reason?.trim()),
  };
}

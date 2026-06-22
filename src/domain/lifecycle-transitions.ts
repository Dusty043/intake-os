import type { RequestStatus } from "./types.js";

export type LifecycleAction =
  | "mark_started"
  | "mark_blocked"
  | "unblock"
  | "mark_completed"
  | "mark_canceled"
  | "archive";

export interface LifecycleTransition {
  from: RequestStatus[];
  to: RequestStatus;
}

export const lifecycleTransitions: Record<LifecycleAction, LifecycleTransition> = {
  mark_started: { from: ["distributed"], to: "in_progress" },
  mark_blocked: { from: ["distributed", "in_progress"], to: "blocked" },
  unblock: { from: ["blocked"], to: "in_progress" },
  mark_completed: { from: ["in_progress", "blocked"], to: "completed" },
  mark_canceled: { from: ["distributed", "in_progress", "blocked"], to: "canceled" },
  archive: { from: ["completed", "canceled"], to: "archived" },
};

export interface LifecycleTransitionResult {
  ok: true;
  toStatus: RequestStatus;
}

export interface LifecycleTransitionError {
  ok: false;
  reason: string;
}

export function validateLifecycleTransition(
  action: LifecycleAction,
  currentStatus: RequestStatus,
): LifecycleTransitionResult | LifecycleTransitionError {
  const transition = lifecycleTransitions[action];
  if (!transition.from.includes(currentStatus)) {
    return {
      ok: false,
      reason: `Action "${action}" is not allowed from status "${currentStatus}". Allowed from: ${transition.from.join(", ")}.`,
    };
  }
  return { ok: true, toStatus: transition.to };
}

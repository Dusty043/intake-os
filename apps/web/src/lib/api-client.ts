import type {
  AgentRun,
  AuditEvent,
  CreateIntakeInput,
  EvaluationSummary,
  IntakeEvaluation,
  ProjectIntakeRecord,
  ProvisioningRun,
  ReviseAnalysisDraftInput,
  UiActor,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev_headers";

function actorHeaders(actor: UiActor): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH_MODE !== "google") {
    base["x-actor-id"] = actor.id;
    base["x-actor-role"] = actor.role;
    base["x-actor-name"] = actor.name;
  }
  return base;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.message ?? body?.error ?? msg;
    } catch {
      // keep default
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function listIntakes(actor: UiActor): Promise<ProjectIntakeRecord[]> {
  return request("/intakes", { headers: actorHeaders(actor) });
}

export async function getIntake(id: string, actor: UiActor): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}`, { headers: actorHeaders(actor) });
}

export async function createIntake(
  input: CreateIntakeInput,
  actor: UiActor,
): Promise<ProjectIntakeRecord> {
  return request("/intakes", {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify(input),
  });
}

export async function submitIntake(id: string, actor: UiActor): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/submit`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function resubmitIntake(
  id: string,
  actor: UiActor,
  answers?: Array<{ question: string; answer: string }>,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/resubmit`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ answers }),
  });
}

export async function generateMockAnalysisDraft(
  id: string,
  actor: UiActor,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/analysis-drafts/mock`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function acceptAnalysisDraft(
  id: string,
  draftId: string,
  actor: UiActor,
  reviewerNotes?: string,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/analysis-drafts/${draftId}/accept`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ reviewerNotes: reviewerNotes ?? "Accepted as reviewed." }),
  });
}

export async function rejectAnalysisDraft(
  id: string,
  draftId: string,
  actor: UiActor,
  reason: string,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/analysis-drafts/${draftId}/reject`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ reason }),
  });
}

export async function regenerateAnalysisDraft(
  id: string,
  actor: UiActor,
  guidance: string,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/analysis-drafts/regenerate`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ guidance }),
  });
}

export async function reviseAnalysisDraft(
  id: string,
  draftId: string,
  actor: UiActor,
  input: ReviseAnalysisDraftInput,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/analysis-drafts/${draftId}/revise`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ reviewedPackage: input, reviewerNotes: input.reviewerNotes }),
  });
}

export async function approveGate(
  id: string,
  actor: UiActor,
  gate: "gate_1" | "gate_2",
  comment?: string,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/approvals`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ gate, comment: comment ?? "" }),
  });
}

export async function requestChanges(
  id: string,
  actor: UiActor,
  reason: string,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/request-changes`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ reason }),
  });
}

export async function rejectGate(
  id: string,
  actor: UiActor,
  reason: string,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/rejections`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ reason }),
  });
}

export async function generateProvisioningPlan(
  id: string,
  actor: UiActor,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/provisioning-plan`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function markReadyForProvisioning(
  id: string,
  actor: UiActor,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/provisioning-ready`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function executeDistribution(
  id: string,
  actor: UiActor,
): Promise<ProvisioningRun> {
  return request(`/intakes/${id}/distribution/execute`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function listProvisioningRuns(
  id: string,
  actor: UiActor,
): Promise<ProvisioningRun[]> {
  const result = await request<{ runs: ProvisioningRun[] }>(
    `/intakes/${id}/distribution/runs`,
    { headers: actorHeaders(actor) },
  );
  return result.runs;
}

export async function retryProvisioningRun(
  id: string,
  runId: string,
  actor: UiActor,
): Promise<ProvisioningRun> {
  return request(`/intakes/${id}/distribution/runs/${runId}/retry`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function markProvisioningTargetResolved(
  intakeId: string,
  targetId: string,
  actor: UiActor,
  note?: string,
): Promise<void> {
  await request(`/intakes/${intakeId}/provisioning-targets/${targetId}/mark-resolved`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function getAuditTrail(id: string, actor: UiActor): Promise<AuditEvent[]> {
  return request(`/intakes/${id}/audit`, { headers: actorHeaders(actor) });
}

export async function getAiUsage(
  actor: UiActor,
  filters?: { intakeId?: string; startDate?: string; endDate?: string },
) {
  const params = new URLSearchParams();
  if (filters?.intakeId) params.set("intakeId", filters.intakeId);
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  const qs = params.toString();
  return request<{
    runs: Array<AgentRun & { intakeId: string }>;
    totalCostUsd: number;
    totalTokens: number;
    runCount: number;
    byModel: Record<string, { count: number; costUsd: number; tokens: number }>;
    byAgentRole: Record<string, { count: number; costUsd: number; tokens: number }>;
    byIntake: Record<string, { count: number; costUsd: number; tokens: number }>;
  }>(`/admin/ai-usage${qs ? `?${qs}` : ""}`, { headers: actorHeaders(actor) });
}

export async function getAiUsageSummary(actor: UiActor, month?: string) {
  const qs = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<{
    month: string;
    totalCostUsd: number;
    totalTokens: number;
    runCount: number;
    byModel: Record<string, { count: number; costUsd: number }>;
    byAgentRole: Record<string, { count: number; costUsd: number }>;
  }>(`/admin/ai-usage/summary${qs}`, { headers: actorHeaders(actor) });
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/health`, { credentials: "include" });
  return res.json() as Promise<{ status: string }>;
}

export async function listEvaluationsForIntake(
  intakeId: string,
  actor: UiActor,
): Promise<EvaluationSummary[]> {
  const result = await request<{ evaluations: EvaluationSummary[] }>(
    `/intakes/${intakeId}/evaluations`,
    { headers: actorHeaders(actor) },
  );
  return result.evaluations;
}

export async function getLatestEvaluationForIntake(
  intakeId: string,
  actor: UiActor,
): Promise<{ evaluation: IntakeEvaluation | null; agentRuns: AgentRun[] }> {
  return request(`/intakes/${intakeId}/evaluations/latest`, { headers: actorHeaders(actor) });
}

export async function getEvaluation(
  intakeId: string,
  evaluationId: string,
  actor: UiActor,
): Promise<{ evaluation: IntakeEvaluation; agentRuns: AgentRun[] }> {
  return request(`/intakes/${intakeId}/evaluations/${evaluationId}`, {
    headers: actorHeaders(actor),
  });
}

export type LifecycleAction =
  | "mark_started"
  | "mark_blocked"
  | "unblock"
  | "mark_completed"
  | "mark_canceled"
  | "archive";

export async function executeLifecycleTransition(
  intakeId: string,
  action: LifecycleAction,
  actor: UiActor,
  body?: {
    note?: string;
    blockedReason?: string;
    completedNote?: string;
    canceledReason?: string;
  },
): Promise<{ ok: boolean; status: string }> {
  return request(`/intakes/${intakeId}/lifecycle/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...actorHeaders(actor) },
    body: JSON.stringify(body ?? {}),
  });
}

export async function listDistributedIntakes(actor: UiActor): Promise<ProjectIntakeRecord[]> {
  const result = await listIntakes(actor);
  return result.filter((r) =>
    ["distributed", "in_progress", "blocked", "completed", "canceled"].includes(r.status),
  );
}

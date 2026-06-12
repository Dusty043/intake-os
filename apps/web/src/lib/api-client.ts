import type {
  AuditEvent,
  CreateIntakeInput,
  ProjectIntakeRecord,
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
  comment?: string,
): Promise<ProjectIntakeRecord> {
  return request(`/intakes/${id}/approvals`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ comment: comment ?? "" }),
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

export async function getAuditTrail(id: string, actor: UiActor): Promise<AuditEvent[]> {
  return request(`/intakes/${id}/audit`, { headers: actorHeaders(actor) });
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/health`, { credentials: "include" });
  return res.json() as Promise<{ status: string }>;
}

import type { DiscoverySession } from "./discovery-types";
import type { UiActor } from "./types";
import { actorHeaders, request } from "./http";

export async function startDiscovery(
  userId: string,
  message: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request("/discovery", {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ userId, message }),
  });
}

export async function sendMessage(
  id: string,
  message: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}/message`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ message }),
  });
}

export async function generateSolutions(
  id: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}/solutions`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function answerClarification(
  id: string,
  questionId: string,
  answer: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}/clarifications/answer`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ questionId, answer }),
  });
}

export async function skipClarifications(
  id: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}/clarifications/skip`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function selectDirection(
  id: string,
  solutionId: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}/direction`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ solutionId }),
  });
}

export async function generateProposal(
  id: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}/proposal`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function generateManifest(
  id: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}/manifest`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function sendToEvaluation(
  id: string,
  actor: UiActor,
): Promise<{ session: DiscoverySession; intakeRecord: unknown }> {
  return request(`/discovery/${id}/send-to-evaluation`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({}),
  });
}

export async function getDiscoverySession(
  id: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request(`/discovery/${id}`, { headers: actorHeaders(actor) });
}

export async function listDiscoverySessions(
  userId: string,
  actor: UiActor,
): Promise<DiscoverySession[]> {
  return request(`/discovery?userId=${encodeURIComponent(userId)}`, {
    headers: actorHeaders(actor),
  });
}

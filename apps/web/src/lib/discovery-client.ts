import type { DiscoverySession } from "./discovery-types";
import type { UiActor } from "./types";
import { actorHeaders, request, BASE } from "./http";

export type DiscoveryStreamEvent =
  | { type: "stage-start"; stage: string }
  | { type: "token"; stage: string; text: string }
  | { type: "stage-end"; stage: string }
  | { type: "error"; stage: string; message: string };

/**
 * Opens a live SSE stream for a Discovery session's progress and calls
 * onEvent for each stage-start/token/stage-end/error event. Uses fetch +
 * ReadableStream (not EventSource) because EventSource can't carry the
 * x-actor-* headers this app's default auth mode requires. Resolves when
 * the stream ends (server close) or the given signal aborts it.
 */
export async function streamDiscoverySession(
  id: string,
  actor: UiActor,
  onEvent: (event: DiscoveryStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/discovery/${id}/stream`, {
    headers: actorHeaders(actor),
    credentials: "include",
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice("data: ".length)) as DiscoveryStreamEvent);
      } catch {
        // Malformed frame — skip it, the stream continues.
      }
    }
  }
}

export async function startDiscovery(
  message: string,
  actor: UiActor,
): Promise<DiscoverySession> {
  return request("/discovery", {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify({ message }),
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

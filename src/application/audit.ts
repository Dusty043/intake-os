import type { Actor, AuditEvent, RequestStatus } from "../domain/types.js";

export interface CreateAuditEventInput {
  requestId: string;
  actor: Actor;
  action: string;
  timestamp: string;
  fromState?: RequestStatus;
  toState?: RequestStatus;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  const event: AuditEvent = {
    requestId: input.requestId,
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: input.action,
    timestamp: input.timestamp,
  };

  if (input.fromState) {
    event.fromState = input.fromState;
  }

  if (input.toState) {
    event.toState = input.toState;
  }

  if (input.reason) {
    event.reason = input.reason;
  }

  if (input.metadata) {
    event.metadata = input.metadata;
  }

  return event;
}

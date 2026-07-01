import type { DiscoveryAgentUsageRecord, DiscoverySession } from "../../domain/discovery.js";
import { NotFoundError } from "../errors.js";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface DiscoveryUsageFilters {
  startDate?: string;
  endDate?: string;
}

export interface IDiscoverySessionStore {
  create(session: DiscoverySession): Promise<DiscoverySession>;
  getById(id: string): Promise<DiscoverySession | null>;
  update(id: string, patch: Partial<DiscoverySession>): Promise<DiscoverySession>;
  listByUser(userId: string): Promise<DiscoverySession[]>;
  /** Flattens usage records across all sessions for admin cost reporting. */
  listAllUsageRecords(
    filters?: DiscoveryUsageFilters,
  ): Promise<Array<DiscoveryAgentUsageRecord & { sessionId: string }>>;
}

// ─── In-Memory Implementation ─────────────────────────────────────────────────

export class InMemoryDiscoverySessionStore implements IDiscoverySessionStore {
  private readonly sessions = new Map<string, DiscoverySession>();

  async create(session: DiscoverySession): Promise<DiscoverySession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async getById(id: string): Promise<DiscoverySession | null> {
    return this.sessions.get(id) ?? null;
  }

  async update(id: string, patch: Partial<DiscoverySession>): Promise<DiscoverySession> {
    const existing = this.sessions.get(id);
    if (!existing) throw new NotFoundError("DiscoverySession", id);
    const updated: DiscoverySession = { ...existing, ...patch };
    this.sessions.set(id, updated);
    return updated;
  }

  async listByUser(userId: string): Promise<DiscoverySession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  async listAllUsageRecords(
    filters?: DiscoveryUsageFilters,
  ): Promise<Array<DiscoveryAgentUsageRecord & { sessionId: string }>> {
    return flattenDiscoveryUsage(Array.from(this.sessions.values()), filters);
  }
}

// ─── Shared aggregation helper ─────────────────────────────────────────────────

export function flattenDiscoveryUsage(
  sessions: DiscoverySession[],
  filters?: DiscoveryUsageFilters,
): Array<DiscoveryAgentUsageRecord & { sessionId: string }> {
  const results: Array<DiscoveryAgentUsageRecord & { sessionId: string }> = [];
  for (const session of sessions) {
    for (const record of session.usageRecords ?? []) {
      if (filters?.startDate && record.createdAt < filters.startDate) continue;
      if (filters?.endDate && record.createdAt > filters.endDate) continue;
      results.push({ ...record, sessionId: session.id });
    }
  }
  return results;
}

import type { DiscoverySession } from "../../domain/discovery.js";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IDiscoverySessionStore {
  create(session: DiscoverySession): Promise<DiscoverySession>;
  getById(id: string): Promise<DiscoverySession | null>;
  update(id: string, patch: Partial<DiscoverySession>): Promise<DiscoverySession>;
  listByUser(userId: string): Promise<DiscoverySession[]>;
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
    if (!existing) throw new Error(`DiscoverySession not found: ${id}`);
    const updated: DiscoverySession = { ...existing, ...patch };
    this.sessions.set(id, updated);
    return updated;
  }

  async listByUser(userId: string): Promise<DiscoverySession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }
}

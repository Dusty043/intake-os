import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { DiscoveryAgentUsageRecord, DiscoverySession } from "../../../../src/domain/discovery.js";
import type { DiscoveryUsageFilters, IDiscoverySessionStore } from "../../../../src/application/discovery/discovery-session-store.js";
import { flattenDiscoveryUsage } from "../../../../src/application/discovery/discovery-session-store.js";
import { PrismaService } from "../prisma/prisma.service.js";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

@Injectable()
export class PrismaDiscoverySessionStore implements IDiscoverySessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: DiscoverySession): Promise<DiscoverySession> {
    await this.prisma.discoverySessionRecord.create({
      data: {
        id: session.id,
        userId: session.userId,
        status: session.status,
        snapshot: toJson(session),
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      },
    });
    return session;
  }

  async getById(id: string): Promise<DiscoverySession | null> {
    const row = await this.prisma.discoverySessionRecord.findUnique({
      where: { id },
      select: { snapshot: true },
    });
    return row ? fromJson<DiscoverySession>(row.snapshot) : null;
  }

  async update(id: string, patch: Partial<DiscoverySession>): Promise<DiscoverySession> {
    const row = await this.prisma.discoverySessionRecord.findUnique({
      where: { id },
      select: { snapshot: true },
    });
    if (!row) throw new Error(`DiscoverySession not found: ${id}`);

    const existing = fromJson<DiscoverySession>(row.snapshot);
    const updated: DiscoverySession = { ...existing, ...patch };

    await this.prisma.discoverySessionRecord.update({
      where: { id },
      data: {
        status: updated.status,
        snapshot: toJson(updated),
        updatedAt: new Date(updated.updatedAt),
      },
    });

    return updated;
  }

  async listByUser(userId: string): Promise<DiscoverySession[]> {
    const rows = await this.prisma.discoverySessionRecord.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { snapshot: true },
    });
    return rows.map((row) => fromJson<DiscoverySession>(row.snapshot));
  }

  async listAllUsageRecords(
    filters?: DiscoveryUsageFilters,
  ): Promise<Array<DiscoveryAgentUsageRecord & { sessionId: string }>> {
    // Sessions are stored as opaque JSON snapshots, so usage records can't be
    // filtered in SQL — this loads every session and filters in memory, same
    // tradeoff as InMemoryProjectIntakeStore.listAllAgentRuns. Fine for an
    // admin-only report at current volume; revisit if session count grows large.
    const rows = await this.prisma.discoverySessionRecord.findMany({
      select: { snapshot: true },
    });
    const sessions = rows.map((row) => fromJson<DiscoverySession>(row.snapshot));
    return flattenDiscoveryUsage(sessions, filters);
  }
}

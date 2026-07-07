import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { DiscoveryAgentUsageRecord, DiscoverySession } from "../../../../src/domain/discovery.js";
import type { DiscoveryUsageFilters, IDiscoverySessionStore } from "../../../../src/application/discovery/discovery-session-store.js";
import { flattenDiscoveryUsage } from "../../../../src/application/discovery/discovery-session-store.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ConflictError, NotFoundError } from "../../../../src/application/errors.js";

const MAX_UPDATE_ATTEMPTS = 3;

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

  // Optimistic concurrency, no migration needed: reuse the existing `updatedAt`
  // column as the compare-and-swap key instead of adding a dedicated version
  // column. `updateMany` with `updatedAt` in the WHERE clause is a single
  // atomic UPDATE ... WHERE statement, so no explicit transaction is needed —
  // if another request committed between our read and write, `updatedAt` on
  // the row will have moved and `count` comes back 0, so we retry the whole
  // read-merge-write with a fresh row instead of blindly overwriting it.
  async update(id: string, patch: Partial<DiscoverySession>): Promise<DiscoverySession> {
    for (let attempt = 1; attempt <= MAX_UPDATE_ATTEMPTS; attempt++) {
      const row = await this.prisma.discoverySessionRecord.findUnique({
        where: { id },
        select: { snapshot: true, updatedAt: true },
      });
      if (!row) throw new NotFoundError("DiscoverySession", id);

      const existing = fromJson<DiscoverySession>(row.snapshot);
      const updated: DiscoverySession = { ...existing, ...patch };

      const result = await this.prisma.discoverySessionRecord.updateMany({
        where: { id, updatedAt: row.updatedAt },
        data: {
          status: updated.status,
          snapshot: toJson(updated),
          updatedAt: new Date(updated.updatedAt),
        },
      });

      if (result.count === 1) return updated;
      // Someone else updated this row between our read and write — retry.
    }

    throw new ConflictError(
      `DiscoverySession ${id} was updated concurrently by another request; retry exhausted after ${MAX_UPDATE_ATTEMPTS} attempts`,
    );
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
    // Sessions are stored as opaque JSON snapshots, so individual usage records
    // can't be filtered in SQL directly — the exact per-record filter still has
    // to happen in memory below, same tradeoff as
    // InMemoryProjectIntakeStore.listAllAgentRuns. But every write path appends
    // usage records and bumps `updatedAt` together in the same `update()` call
    // (see discovery-orchestrator.ts), so a session's `updatedAt` is always >=
    // every usage record's createdAt it contains, and its `createdAt` is always
    // <= every usage record's createdAt. That makes those two columns a safe
    // (necessary, not sufficient) SQL pre-filter to skip sessions that can't
    // possibly contain a record in range, cutting rows fetched for narrow
    // date-range admin reports.
    const rows = await this.prisma.discoverySessionRecord.findMany({
      select: { snapshot: true },
      where: {
        updatedAt: filters?.startDate ? { gte: new Date(filters.startDate) } : undefined,
        createdAt: filters?.endDate ? { lte: new Date(filters.endDate) } : undefined,
      },
    });
    const sessions = rows.map((row) => fromJson<DiscoverySession>(row.snapshot));
    return flattenDiscoveryUsage(sessions, filters);
  }
}

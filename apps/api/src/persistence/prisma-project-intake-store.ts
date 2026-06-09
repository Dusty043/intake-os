import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuditEvent, RequestStatus, UserRole } from "../../../../src/domain/types.js";
import type { ProjectIntakeRecord, ProjectIntakeStore } from "../../../../src/application/types.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PrismaProjectIntakeStore implements ProjectIntakeStore {
  constructor(private readonly prisma: PrismaService) {}

  async listIntakes(): Promise<readonly ProjectIntakeRecord[]> {
    const rows = await this.prisma.projectIntake.findMany({
      orderBy: { createdAt: "desc" },
      select: { recordSnapshot: true },
    });

    return rows.map((row) => fromJson<ProjectIntakeRecord>(row.recordSnapshot));
  }

  async getIntake(id: string): Promise<ProjectIntakeRecord | null> {
    const row = await this.prisma.projectIntake.findUnique({
      where: { id },
      select: { recordSnapshot: true },
    });

    return row ? fromJson<ProjectIntakeRecord>(row.recordSnapshot) : null;
  }

  async saveIntake(record: ProjectIntakeRecord): Promise<ProjectIntakeRecord> {
    const snapshot = toJson(record);
    const distributionPackage = record.distributionPackage ? toJson(record.distributionPackage) : undefined;
    const analysisDrafts = record.analysisDrafts ? toJson(record.analysisDrafts) : undefined;
    const latestAnalysisDraft = record.latestAnalysisDraft ? toJson(record.latestAnalysisDraft) : undefined;
    const sourceRawPayload = record.source.rawPayload ? toJson(record.source.rawPayload) : undefined;

    const saved = await this.prisma.projectIntake.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        title: record.title,
        description: record.description,
        requester: record.requester,
        department: record.department,
        projectType: record.projectType,
        status: record.status,
        sourceSystem: record.source.system,
        sourceExternalId: record.source.externalId,
        sourceExternalUrl: record.source.externalUrl,
        sourceRawPayload,
        distributionPackage,
        analysisDrafts,
        latestAnalysisDraft,
        recordSnapshot: snapshot,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt ?? record.createdAt),
        createdById: record.createdBy.id,
        createdByRole: record.createdBy.role,
        createdByName: record.createdBy.displayName,
      },
      update: {
        title: record.title,
        description: record.description,
        requester: record.requester,
        department: record.department,
        projectType: record.projectType,
        status: record.status,
        sourceSystem: record.source.system,
        sourceExternalId: record.source.externalId,
        sourceExternalUrl: record.source.externalUrl,
        sourceRawPayload,
        distributionPackage,
        analysisDrafts,
        latestAnalysisDraft,
        recordSnapshot: snapshot,
        updatedAt: new Date(record.updatedAt ?? new Date().toISOString()),
      },
      select: { recordSnapshot: true },
    });

    return fromJson<ProjectIntakeRecord>(saved.recordSnapshot);
  }

  async listAuditEvents(intakeId: string): Promise<readonly AuditEvent[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { intakeId },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      requestId: row.intakeId,
      actorId: row.actorId,
      actorRole: row.actorRole as UserRole,
      action: row.action,
      ...(row.fromState ? { fromState: row.fromState as RequestStatus } : {}),
      ...(row.toState ? { toState: row.toState as RequestStatus } : {}),
      timestamp: row.timestamp.toISOString(),
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.metadata ? { metadata: fromJson<Record<string, unknown>>(row.metadata) } : {}),
    }));
  }

  async appendAuditEvent(event: AuditEvent): Promise<AuditEvent> {
    const row = await this.prisma.auditEvent.create({
      data: {
        intakeId: event.requestId,
        actorId: event.actorId,
        actorRole: event.actorRole,
        action: event.action,
        fromState: event.fromState,
        toState: event.toState,
        reason: event.reason,
        metadata: event.metadata ? toJson(event.metadata) : undefined,
        timestamp: new Date(event.timestamp),
      },
    });

    return {
      requestId: row.intakeId,
      actorId: row.actorId,
      actorRole: row.actorRole as UserRole,
      action: row.action,
      ...(row.fromState ? { fromState: row.fromState as RequestStatus } : {}),
      ...(row.toState ? { toState: row.toState as RequestStatus } : {}),
      timestamp: row.timestamp.toISOString(),
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.metadata ? { metadata: fromJson<Record<string, unknown>>(row.metadata) } : {}),
    };
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuditEvent, RequestStatus, UserRole } from "../../../../src/domain/types.js";
import type { ProjectIntakeRecord, ProjectIntakeStore, ProvisioningRun } from "../../../../src/application/types.js";
import type { ProvisioningTargetResult } from "../../../../src/domain/provisioning.js";
import type { AgentRunRecord, EvaluationPersistenceBundle } from "../../../../src/application/evaluation-persistence.js";
import type { IntakeEvaluation } from "../../../../src/application/intake-evaluation.js";
import {
  agentRunsFromEvaluation,
  fromEvaluationRow,
  fromAgentRunRow,
} from "../../../../src/application/evaluation-persistence.js";
import { validateIntakeEvaluation } from "../../../../src/application/intake-evaluation.js";
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

  async saveEvaluation(bundle: EvaluationPersistenceBundle): Promise<void> {
    validateIntakeEvaluation(bundle.evaluation);
    const { evaluation } = bundle;
    const runs = bundle.agentRuns ?? agentRunsFromEvaluation(evaluation);

    await this.prisma.$transaction(async (tx) => {
      await tx.intakeEvaluation.upsert({
        where: { id: evaluation.id },
        create: {
          id: evaluation.id,
          intakeId: evaluation.intakeId,
          depth: evaluation.depth,
          status: evaluation.status,
          qualityScore: evaluation.qualityScore ? toJson(evaluation.qualityScore) : undefined,
          evaluationVersion: evaluation.evaluationVersion,
          createdAt: new Date(evaluation.createdAt),
          createdById: evaluation.createdBy.id,
          createdByName: evaluation.createdBy.displayName,
          createdByEmail: undefined,
          createdByRole: evaluation.createdBy.role,
        },
        update: {
          status: evaluation.status,
          qualityScore: evaluation.qualityScore ? toJson(evaluation.qualityScore) : undefined,
          evaluationVersion: evaluation.evaluationVersion,
        },
      });

      await tx.evaluationSection.deleteMany({ where: { evaluationId: evaluation.id } });
      for (const section of evaluation.sections) {
        await tx.evaluationSection.create({
          data: {
            id: section.id,
            evaluationId: section.evaluationId,
            sectionKind: section.kind,
            content: toJson(section.content),
            provenance: toJson(section.provenance),
            version: section.version,
            supersededById: section.supersededById,
            createdAt: new Date(section.provenance.generatedAt),
          },
        });
      }

      await tx.agentRun.deleteMany({ where: { evaluationId: evaluation.id } });
      for (const run of runs) {
        await tx.agentRun.create({
          data: {
            id: run.id,
            evaluationId: run.evaluationId,
            sectionId: run.sectionId,
            agentRole: run.agentRole,
            provider: run.provider,
            model: run.model,
            inputTokens: run.inputTokens,
            outputTokens: run.outputTokens,
            totalTokens: run.totalTokens,
            latencyMs: run.latencyMs,
            estimatedCostUsd:
              run.estimatedCostUsd !== undefined && run.estimatedCostUsd !== null
                ? run.estimatedCostUsd
                : undefined,
            finishReason: run.finishReason,
            status: run.status,
            errorMessage: run.errorMessage,
            startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
            completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
            createdAt: new Date(run.createdAt),
          },
        });
      }
    });
  }

  async getEvaluation(intakeId: string, evaluationId: string): Promise<IntakeEvaluation | undefined> {
    const row = await this.prisma.intakeEvaluation.findUnique({
      where: { id: evaluationId },
      include: { sections: { orderBy: { createdAt: "asc" } } },
    });
    if (!row || row.intakeId !== intakeId) return undefined;
    return fromEvaluationRow(row);
  }

  async listEvaluationsForIntake(intakeId: string): Promise<IntakeEvaluation[]> {
    const rows = await this.prisma.intakeEvaluation.findMany({
      where: { intakeId },
      include: { sections: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(fromEvaluationRow);
  }

  async getLatestEvaluationForIntake(intakeId: string): Promise<IntakeEvaluation | undefined> {
    const row = await this.prisma.intakeEvaluation.findFirst({
      where: { intakeId },
      include: { sections: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return row ? fromEvaluationRow(row) : undefined;
  }

  async listAgentRuns(evaluationId: string): Promise<AgentRunRecord[]> {
    const rows = await this.prisma.agentRun.findMany({
      where: { evaluationId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(fromAgentRunRow);
  }

  async listAllAgentRuns(
    filters?: { intakeId?: string; startDate?: string; endDate?: string },
  ): Promise<Array<AgentRunRecord & { intakeId: string }>> {
    const rows = await this.prisma.agentRun.findMany({
      where: {
        evaluation: filters?.intakeId ? { intakeId: filters.intakeId } : undefined,
        createdAt: {
          gte: filters?.startDate ? new Date(filters.startDate) : undefined,
          lte: filters?.endDate ? new Date(filters.endDate) : undefined,
        },
      },
      include: { evaluation: { select: { intakeId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      ...fromAgentRunRow(row),
      intakeId: row.evaluation.intakeId,
    }));
  }

  async getEvaluationById(evaluationId: string): Promise<IntakeEvaluation | undefined> {
    const row = await this.prisma.intakeEvaluation.findUnique({
      where: { id: evaluationId },
      include: { sections: { orderBy: { createdAt: "asc" } } },
    });
    return row ? fromEvaluationRow(row) : undefined;
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

  async saveProvisioningRun(run: ProvisioningRun): Promise<ProvisioningRun> {
    await this.prisma.$transaction(async (tx) => {
      await tx.provisioningRun.upsert({
        where: { id: run.id },
        create: {
          id: run.id,
          intakeId: run.intakeId,
          planId: run.planId,
          status: run.status,
          kind: run.kind,
          retryOfRunId: run.retryOfRunId ?? null,
          triggeredById: run.triggeredById,
          triggeredByRole: run.triggeredByRole,
          triggeredByName: run.triggeredByName,
          startedAt: new Date(run.startedAt),
          completedAt: run.completedAt ? new Date(run.completedAt) : null,
          errorSummary: run.errorSummary ?? null,
        },
        update: {
          status: run.status,
          completedAt: run.completedAt ? new Date(run.completedAt) : null,
          errorSummary: run.errorSummary ?? null,
        },
      });

      for (const target of run.targets) {
        await tx.provisioningTargetResult.upsert({
          where: { idempotencyKey: target.idempotencyKey },
          create: {
            id: target.id,
            runId: target.runId,
            targetKind: target.targetKind,
            status: target.status,
            idempotencyKey: target.idempotencyKey,
            externalId: target.externalId,
            externalUrl: target.externalUrl,
            errorMessage: target.errorMessage,
            errorCategory: target.errorCategory ?? null,
            attemptCount: target.attemptCount,
            retryable: target.retryable,
            deadLettered: target.deadLettered ?? false,
            deadLetteredAt: target.deadLetteredAt ? new Date(target.deadLetteredAt) : null,
            completedAt: target.completedAt ? new Date(target.completedAt) : null,
          },
          update: {
            status: target.status,
            externalId: target.externalId,
            externalUrl: target.externalUrl,
            errorMessage: target.errorMessage,
            errorCategory: target.errorCategory ?? null,
            attemptCount: target.attemptCount,
            retryable: target.retryable,
            deadLettered: target.deadLettered ?? false,
            deadLetteredAt: target.deadLetteredAt ? new Date(target.deadLetteredAt) : null,
            completedAt: target.completedAt ? new Date(target.completedAt) : null,
          },
        });
      }
    });

    return run;
  }

  async listProvisioningRuns(intakeId: string): Promise<ProvisioningRun[]> {
    const rows = await this.prisma.provisioningRun.findMany({
      where: { intakeId },
      include: { targets: true },
      orderBy: { startedAt: "desc" },
    });
    return rows.map(fromProvisioningRunRow);
  }

  async getProvisioningRun(intakeId: string, runId: string): Promise<ProvisioningRun | undefined> {
    const row = await this.prisma.provisioningRun.findUnique({
      where: { id: runId },
      include: { targets: true },
    });
    if (!row || row.intakeId !== intakeId) return undefined;
    return fromProvisioningRunRow(row);
  }

  async updateProvisioningTargetResult(
    targetId: string,
    updates: Partial<ProvisioningTargetResult>,
  ): Promise<void> {
    await this.prisma.provisioningTargetResult.update({
      where: { id: targetId },
      data: {
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.retryable !== undefined && { retryable: updates.retryable }),
        ...(updates.deadLettered !== undefined && { deadLettered: updates.deadLettered }),
        ...(updates.deadLetteredAt !== undefined && {
          deadLetteredAt: new Date(updates.deadLetteredAt),
        }),
        ...(updates.errorCategory !== undefined && { errorCategory: updates.errorCategory }),
        ...(updates.errorMessage !== undefined && { errorMessage: updates.errorMessage }),
        ...(updates.completedAt !== undefined && {
          completedAt: new Date(updates.completedAt),
        }),
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fromProvisioningRunRow(row: {
  id: string;
  intakeId: string;
  planId: string;
  status: string;
  kind: string;
  retryOfRunId: string | null;
  triggeredById: string;
  triggeredByRole: string;
  triggeredByName: string | null;
  startedAt: Date;
  completedAt: Date | null;
  errorSummary?: string | null;
  targets: {
    id: string;
    runId: string;
    targetKind: string;
    status: string;
    idempotencyKey: string;
    externalId: string | null;
    externalUrl: string | null;
    errorMessage: string | null;
    errorCategory?: string | null;
    attemptCount: number;
    retryable: boolean;
    deadLettered?: boolean;
    deadLetteredAt?: Date | null;
    completedAt: Date | null;
  }[];
}): ProvisioningRun {
  return {
    id: row.id,
    intakeId: row.intakeId,
    planId: row.planId,
    status: row.status as ProvisioningRun["status"],
    kind: (row.kind ?? "initial") as ProvisioningRun["kind"],
    retryOfRunId: row.retryOfRunId ?? undefined,
    triggeredById: row.triggeredById,
    triggeredByRole: row.triggeredByRole,
    triggeredByName: row.triggeredByName ?? undefined,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    errorSummary: row.errorSummary ?? undefined,
    targets: row.targets.map((t) => ({
      id: t.id,
      runId: t.runId,
      targetKind: t.targetKind as ProvisioningRun["targets"][number]["targetKind"],
      status: t.status as ProvisioningRun["targets"][number]["status"],
      idempotencyKey: t.idempotencyKey,
      externalId: t.externalId ?? undefined,
      externalUrl: t.externalUrl ?? undefined,
      errorMessage: t.errorMessage ?? undefined,
      errorCategory: t.errorCategory ?? undefined,
      attemptCount: t.attemptCount,
      retryable: t.retryable,
      deadLettered: t.deadLettered ?? false,
      deadLetteredAt: t.deadLetteredAt?.toISOString(),
      completedAt: t.completedAt?.toISOString(),
    })),
  };
}

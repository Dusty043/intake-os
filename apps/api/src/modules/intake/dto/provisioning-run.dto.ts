import type { ProvisioningRun } from "../../../../../../src/application/types.js";

export class ProvisioningTargetResultDto {
  id!: string;
  targetKind!: string;
  status!: string;
  idempotencyKey!: string;
  externalId?: string;
  externalUrl?: string;
  errorMessage?: string;
  attemptCount!: number;
  retryable!: boolean;
  completedAt?: string;
}

export class ProvisioningRunDto {
  id!: string;
  intakeId!: string;
  planId!: string;
  status!: string;
  kind!: string;
  retryOfRunId?: string;
  triggeredById!: string;
  triggeredByRole!: string;
  triggeredByName?: string;
  startedAt!: string;
  completedAt?: string;
  targets!: ProvisioningTargetResultDto[];
}

export function toProvisioningRunDto(run: ProvisioningRun): ProvisioningRunDto {
  return {
    id: run.id,
    intakeId: run.intakeId,
    planId: run.planId,
    status: run.status,
    kind: run.kind,
    retryOfRunId: run.retryOfRunId,
    triggeredById: run.triggeredById,
    triggeredByRole: run.triggeredByRole,
    triggeredByName: run.triggeredByName,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    targets: run.targets.map((t) => ({
      id: t.id,
      targetKind: t.targetKind,
      status: t.status,
      idempotencyKey: t.idempotencyKey,
      externalId: t.externalId,
      externalUrl: t.externalUrl,
      errorMessage: t.errorMessage,
      attemptCount: t.attemptCount,
      retryable: t.retryable,
      completedAt: t.completedAt,
    })),
  };
}

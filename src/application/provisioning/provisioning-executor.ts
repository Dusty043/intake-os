import type { Actor } from "../../domain/types.js";
import type { ProvisioningTargetKind, ProvisioningTargetResult } from "../../domain/provisioning.js";
import type { ReviewedProjectPackage } from "../types.js";

export interface ProvisioningContext {
  intakeId: string;
  planId: string;
  runId: string;
  actor: Actor;
  reviewedPackage: ReviewedProjectPackage;
}

export interface ProvisioningExecutor {
  readonly targetKind: ProvisioningTargetKind;
  execute(ctx: ProvisioningContext): Promise<ProvisioningTargetResult>;
  canRetry(result: ProvisioningTargetResult): boolean;
}

export class ProvisioningRegistry {
  private readonly executors = new Map<ProvisioningTargetKind, ProvisioningExecutor>();

  register(executor: ProvisioningExecutor): void {
    this.executors.set(executor.targetKind, executor);
  }

  getAll(): ProvisioningExecutor[] {
    return [...this.executors.values()];
  }

  get size(): number {
    return this.executors.size;
  }
}

import type { ProvisioningTargetKind, ProvisioningTargetResult } from "../../domain/provisioning.js";
import type { ProvisioningContext, ProvisioningExecutor } from "./provisioning-executor.js";

export type MockExecutorMode =
  | "success"
  | "full_failure"
  | "monday_fail"
  | "github_fail"
  | "github_fail_then_succeed"
  | "monday_fail_then_succeed"
  | "both_fail_then_succeed";

function makeResult(
  ctx: ProvisioningContext,
  targetKind: ProvisioningTargetKind,
  succeeded: boolean,
  externalId?: string,
  externalUrl?: string,
): ProvisioningTargetResult {
  return {
    id: `tgt-${ctx.runId}-${targetKind}`,
    runId: ctx.runId,
    targetKind,
    status: succeeded ? "succeeded" : "failed",
    idempotencyKey: ctx.isRetry
      ? `${ctx.intakeId}:${ctx.planId}:${targetKind}:retry:${ctx.runId}`
      : `${ctx.intakeId}:${ctx.planId}:${targetKind}`,
    externalId: succeeded ? externalId : undefined,
    externalUrl: succeeded ? externalUrl : undefined,
    errorMessage: succeeded ? undefined : `Mock ${targetKind} failure (mode: executor simulation)`,
    attemptCount: 1,
    retryable: !succeeded,
    completedAt: new Date().toISOString(),
  };
}

export class MockMondayExecutor implements ProvisioningExecutor {
  readonly targetKind: ProvisioningTargetKind = "monday_project_item";

  constructor(private readonly mode: MockExecutorMode = "success") {}

  async execute(ctx: ProvisioningContext): Promise<ProvisioningTargetResult> {
    const succeeded = this.shouldSucceed(ctx.isRetry);
    return makeResult(
      ctx,
      "monday_project_item",
      succeeded,
      succeeded ? `mock-monday-item-${ctx.intakeId.slice(-6)}` : undefined,
      succeeded ? `https://monday.com/boards/mock/items/mock-${ctx.intakeId.slice(-6)}` : undefined,
    );
  }

  canRetry(result: ProvisioningTargetResult): boolean {
    return result.status === "failed";
  }

  private shouldSucceed(isRetry: boolean): boolean {
    switch (this.mode) {
      case "success": return true;
      case "full_failure": return false;
      case "monday_fail": return false;
      case "github_fail": return true;
      case "monday_fail_then_succeed": return isRetry;
      case "github_fail_then_succeed": return true;
      case "both_fail_then_succeed": return isRetry;
    }
  }
}

export class MockGithubExecutor implements ProvisioningExecutor {
  readonly targetKind: ProvisioningTargetKind = "github_repo";

  constructor(private readonly mode: MockExecutorMode = "success") {}

  async execute(ctx: ProvisioningContext): Promise<ProvisioningTargetResult> {
    const succeeded = this.shouldSucceed(ctx.isRetry);
    const slug = ctx.reviewedPackage.brief.solution
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32);
    return makeResult(
      ctx,
      "github_repo",
      succeeded,
      succeeded ? `mock-repo-${slug}` : undefined,
      succeeded ? `https://github.com/mock-org/mock-repo-${slug}` : undefined,
    );
  }

  canRetry(result: ProvisioningTargetResult): boolean {
    return result.status === "failed";
  }

  private shouldSucceed(isRetry: boolean): boolean {
    switch (this.mode) {
      case "success": return true;
      case "full_failure": return false;
      case "monday_fail": return true;
      case "github_fail": return false;
      case "github_fail_then_succeed": return isRetry;
      case "monday_fail_then_succeed": return true;
      case "both_fail_then_succeed": return isRetry;
    }
  }
}

export function createMockRegistry(mode: MockExecutorMode = "success") {
  return [new MockMondayExecutor(mode), new MockGithubExecutor(mode)];
}

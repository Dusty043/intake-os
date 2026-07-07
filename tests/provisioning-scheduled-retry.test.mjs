/**
 * Q-FAR-3: auto-retry backoff runs as a detached background continuation instead of
 * blocking the caller. These tests exercise that path directly — the existing mock
 * executors (createMockRegistry) never produce an auto-retryable error category, so
 * this path isn't covered anywhere else.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
  ProvisioningRegistry,
} from "../dist/src/index.js";

const NOW = "2026-06-17T00:00:00.000Z";
const creator = { id: "user-creator", role: "request_creator", displayName: "Creator" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const devopsLead = { id: "user-devops", role: "devops_lead", displayName: "DevOps Lead" };

// Fails with a transient-category message (matches error-categories.ts keyword rules)
// for the first `failCount` calls, then succeeds.
class TransientThenSucceedExecutor {
  targetKind = "monday_project_item";
  callCount = 0;

  constructor(failCount) {
    this.failCount = failCount;
  }

  async execute(ctx) {
    this.callCount++;
    const base = {
      id: `tgt-${ctx.runId}-monday_project_item`,
      runId: ctx.runId,
      targetKind: "monday_project_item",
      idempotencyKey: `${ctx.intakeId}:${ctx.planId}:monday_project_item`,
      attemptCount: this.callCount,
      completedAt: new Date().toISOString(),
    };
    if (this.callCount <= this.failCount) {
      return {
        ...base,
        status: "failed",
        errorMessage: "503 Service Unavailable from Monday API",
        retryable: true,
      };
    }
    return {
      ...base,
      status: "succeeded",
      externalId: "mock-item",
      externalUrl: "https://monday.com/mock",
      retryable: false,
    };
  }

  canRetry(result) {
    return result.status === "failed";
  }
}

function createService(executor) {
  let counter = 0;
  const registry = new ProvisioningRegistry();
  registry.register(executor);
  return new IntakeWorkflowService({
    store: new InMemoryProjectIntakeStore(),
    clock: () => NOW,
    idFactory: (prefix) => `${prefix}-${++counter}`,
    provisioningRegistry: registry,
  });
}

async function createApprovedReadyIntake(service) {
  const intake = await service.createIntake(
    {
      title: "Client Throughput Dashboard",
      description:
        "Build an internal dashboard for stakeholders to monitor project throughput, developer workload, and API data sources.",
      requester: "Digital Solutions",
      department: "Internal Tools",
      projectType: "internal_dashboard",
    },
    creator,
  );

  const submitted = await service.submitIntake(intake.id, creator);
  const withDraft = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
  const accepted = await service.acceptAnalysisDraft(
    { intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id, reviewerNotes: "Looks good." },
    intakeOwner,
  );
  const gate1 = await service.recordApproval(accepted.id, { comment: "Gate 1 approved." }, intakeOwner);
  const approved = await service.recordApproval(gate1.id, { comment: "Gate 2 approved." }, devopsLead);

  const planned = await service.generateProvisioningPlan(
    approved.id,
    { teamPrefix: "ds", existingRepositoryNames: [] },
    devopsLead,
  );
  return service.markReadyForProvisioning(planned.id, devopsLead);
}

async function waitForSettled(service, intakeId, runId, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runs = await service.listProvisioningRuns(intakeId);
    const run = runs.find((r) => r.id === runId);
    if (run && run.status !== "executing") return run;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Run ${runId} did not settle within ${timeoutMs}ms`);
}

describe("provisioning — scheduled background retry (Q-FAR-3)", () => {
  it("returns immediately with pending_retry instead of blocking on backoff", async () => {
    const executor = new TransientThenSucceedExecutor(1);
    const service = createService(executor);
    const ready = await createApprovedReadyIntake(service);

    const started = Date.now();
    const run = await service.executeDistribution(ready.id, devopsLead);
    const elapsedMs = Date.now() - started;

    assert.equal(run.status, "executing");
    assert.equal(run.targets.length, 1);
    assert.equal(run.targets[0].status, "pending_retry");
    // The backoff before the 2nd attempt is ~1s (calculateBackoffMs(1)); returning in well
    // under that proves this call didn't block on it.
    assert.ok(elapsedMs < 500, `expected an immediate return, took ${elapsedMs}ms`);
  });

  it("background retry eventually succeeds and finalizes the run + workflow transition", async () => {
    const executor = new TransientThenSucceedExecutor(1);
    const service = createService(executor);
    const ready = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(ready.id, devopsLead);
    const settled = await waitForSettled(service, ready.id, run.id);

    assert.equal(settled.status, "completed");
    assert.equal(settled.targets[0].status, "succeeded");
    assert.equal(settled.targets[0].attemptCount, 2);

    const intake = await service.getIntake(ready.id, devopsLead);
    assert.equal(intake.status, "distributed");
  });

  it("background retry that exhausts all attempts fails the run and transitions to provisioning_failed", async () => {
    const executor = new TransientThenSucceedExecutor(Number.POSITIVE_INFINITY);
    const service = createService(executor);
    const ready = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(ready.id, devopsLead);
    const settled = await waitForSettled(service, ready.id, run.id);

    assert.equal(settled.status, "failed");
    assert.equal(settled.targets[0].status, "failed");
    assert.equal(settled.targets[0].attemptCount, 3); // AUTO_RETRY_MAX

    const intake = await service.getIntake(ready.id, devopsLead);
    assert.equal(intake.status, "provisioning_failed");
  });
});

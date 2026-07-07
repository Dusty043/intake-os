import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConflictError,
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
  ProvisioningRegistry,
  ValidationError,
  createMockRegistry,
} from "../dist/src/index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = "2026-06-17T00:00:00.000Z";
const creator = { id: "user-creator", role: "request_creator", displayName: "Creator" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const devopsLead = { id: "user-devops", role: "devops_lead", displayName: "DevOps Lead" };

function createService(executorMode = "success", withRegistry = true) {
  let counter = 0;
  const registry = withRegistry ? new ProvisioningRegistry() : undefined;
  if (registry) {
    for (const executor of createMockRegistry(executorMode)) {
      registry.register(executor);
    }
  }
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

  assert.equal(approved.status, "approved");
  assert.ok(approved.reviewedProjectPackage, "reviewedProjectPackage required for distribution");

  const planned = await service.generateProvisioningPlan(
    approved.id,
    { teamPrefix: "ds", existingRepositoryNames: [] },
    devopsLead,
  );
  const ready = await service.markReadyForProvisioning(planned.id, devopsLead);
  assert.equal(ready.provisioningPlan.status, "ready_for_provisioning");
  return ready;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("provisioning execution — mock executor", () => {
  it("full success: run completes, intake transitions to distributed", async () => {
    const service = createService("success");
    const intake = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(intake.id, devopsLead);

    assert.equal(run.status, "completed");
    assert.equal(run.intakeId, intake.id);
    assert.ok(run.completedAt, "completedAt should be set");
    assert.equal(run.targets.length, 2);
    assert.ok(run.targets.every((t) => t.status === "succeeded"));

    const updated = await service.getIntake(intake.id, devopsLead);
    assert.equal(updated.status, "distributed");
  });

  it("full failure: run fails, intake transitions to provisioning_failed", async () => {
    const service = createService("full_failure");
    const intake = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(intake.id, devopsLead);

    assert.equal(run.status, "failed");
    assert.ok(run.targets.every((t) => t.status === "failed"));

    const updated = await service.getIntake(intake.id, devopsLead);
    assert.equal(updated.status, "provisioning_failed");
  });

  it("monday fails: partial_success, intake transitions to provisioning_failed", async () => {
    const service = createService("monday_fail");
    const intake = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(intake.id, devopsLead);

    assert.equal(run.status, "partial_success");
    const mondayTarget = run.targets.find((t) => t.targetKind === "monday_project_item");
    const githubTarget = run.targets.find((t) => t.targetKind === "github_repo");
    assert.equal(mondayTarget.status, "failed");
    assert.equal(githubTarget.status, "succeeded");

    const updated = await service.getIntake(intake.id, devopsLead);
    assert.equal(updated.status, "provisioning_failed");
  });

  it("github fails: partial_success", async () => {
    const service = createService("github_fail");
    const intake = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(intake.id, devopsLead);

    assert.equal(run.status, "partial_success");
    const githubTarget = run.targets.find((t) => t.targetKind === "github_repo");
    assert.equal(githubTarget.status, "failed");
  });

  it("guard: blocked when no gate_1 approval", async () => {
    const service = createService("success");
    const intake = await service.createIntake(
      { title: "Test", description: "Test project", requester: "User", projectType: "internal_tool" },
      creator,
    );
    await service.submitIntake(intake.id, creator);
    const withDraft = await service.generateMockAnalysisDraft(intake.id, {}, intakeOwner);
    await service.acceptAnalysisDraft(
      { intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id },
      intakeOwner,
    );

    await assert.rejects(
      () => service.executeDistribution(intake.id, devopsLead),
      ValidationError,
    );
  });

  it("guard: blocked when plan is draft (not ready_for_provisioning)", async () => {
    const service = createService("success");
    const intake = await service.createIntake(
      {
        title: "Client Throughput Dashboard",
        description: "Build an internal dashboard.",
        requester: "Digital Solutions",
        department: "Internal Tools",
        projectType: "internal_dashboard",
      },
      creator,
    );
    const submitted = await service.submitIntake(intake.id, creator);
    const withDraft = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
    const accepted = await service.acceptAnalysisDraft(
      { intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id },
      intakeOwner,
    );
    const gate1 = await service.recordApproval(accepted.id, { comment: "Gate 1." }, intakeOwner);
    const approved = await service.recordApproval(gate1.id, { comment: "Gate 2." }, devopsLead);
    await service.generateProvisioningPlan(approved.id, { teamPrefix: "ds" }, devopsLead);

    await assert.rejects(
      () => service.executeDistribution(approved.id, devopsLead),
      ValidationError,
    );
  });

  it("guard: blocked when no provisioning registry registered", async () => {
    const service = createService("success", false);
    const intake = await createApprovedReadyIntake(service);

    await assert.rejects(
      () => service.executeDistribution(intake.id, devopsLead),
      ValidationError,
    );
  });

  it("run is persisted and listProvisioningRuns returns it", async () => {
    const service = createService("success");
    const intake = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(intake.id, devopsLead);
    const runs = await service.listProvisioningRuns(intake.id);

    assert.equal(runs.length, 1);
    assert.equal(runs[0].id, run.id);
    assert.equal(runs[0].status, "completed");
    assert.equal(runs[0].targets.length, 2);
  });

  it("successful run stores external IDs from mock executor", async () => {
    const service = createService("success");
    const intake = await createApprovedReadyIntake(service);

    const run = await service.executeDistribution(intake.id, devopsLead);

    const mondayTarget = run.targets.find((t) => t.targetKind === "monday_project_item");
    const githubTarget = run.targets.find((t) => t.targetKind === "github_repo");

    assert.ok(mondayTarget.externalId, "monday target should have externalId");
    assert.ok(mondayTarget.externalUrl, "monday target should have externalUrl");
    assert.ok(githubTarget.externalId, "github target should have externalId");
    assert.ok(githubTarget.externalUrl, "github target should have externalUrl");
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
  PermissionDeniedError,
  ValidationError,
} from "../dist/src/index.js";

const creator = { id: "user-creator", role: "request_creator", displayName: "Creator" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const devopsLead = { id: "user-devops", role: "devops_lead", displayName: "DevOps Lead" };

function createService() {
  let counter = 0;
  return new IntakeWorkflowService({
    store: new InMemoryProjectIntakeStore(),
    clock: () => "2026-05-27T00:00:00.000Z",
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

async function approveHappyPath(service) {
  const intake = await service.createIntake(
    {
      title: "Project Intake OS",
      description: "Internal project governance workflow.",
      requester: "Digital Solutions",
      department: "Internal Tools",
      projectType: "internal_tool",
    },
    creator,
  );

  await service.submitIntake(intake.id, creator);
  await service.completeDiscovery(
    intake.id,
    {
      problemStatement: "Project requests need a repeatable approval process.",
      stakeholders: ["Management", "DevOps"],
      expectedUsers: ["Requesters"],
      systemsTouched: ["GitHub", "Monday"],
      dataSensitivity: "medium",
      infraNeeds: ["Postgres"],
      estimatedComplexity: "medium",
      requiresGithub: true,
      requiresMonday: true,
    },
    intakeOwner,
  );
  await service.recordApproval(intake.id, { comment: "Gate 1 approved." }, intakeOwner);
  return service.recordApproval(intake.id, { comment: "Gate 2 approved." }, devopsLead);
}

test("full MVP lifecycle reaches dry-run ready state with audit trail", async () => {
  const service = createService();
  const approved = await approveHappyPath(service);

  assert.equal(approved.status, "approved");
  assert.equal(approved.approvals.gate_1.status, "approved");
  assert.equal(approved.approvals.gate_2.status, "approved");

  const planned = await service.generateProvisioningPlan(
    approved.id,
    {
      teamPrefix: "Digital Solutions",
      existingRepositoryNames: [],
    },
    devopsLead,
  );

  assert.equal(planned.provisioningPlan.validation.valid, true);
  assert.equal(planned.provisioningPlan.repository.finalRepoName, "ds-tool-project-intake-os");
  assert.ok(planned.provisioningPlan.actions.some((action) => action.system === "github"));
  assert.ok(planned.provisioningPlan.actions.some((action) => action.system === "monday"));
  assert.equal(planned.distributionPackage.validated, true);

  const ready = await service.markReadyForProvisioning(approved.id, devopsLead);
  assert.equal(ready.status, "approved");
  assert.equal(ready.provisioningPlan.status, "ready_for_provisioning");

  const audit = await service.getAuditTrail(approved.id, devopsLead);
  assert.deepEqual(
    audit.map((event) => event.action),
    [
      "INTAKE_CREATED",
      "submit",
      "generate_evaluation",
      "DISCOVERY_COMPLETED",
      "success",
      "approve",
      "approve",
      "PROVISIONING_PLAN_GENERATED",
      "PROVISIONING_READY_MARKED",
    ],
  );
});

test("provisioning plan is blocked before required approvals", async () => {
  const service = createService();
  const intake = await service.createIntake(
    {
      title: "Blocked Project",
      description: "Should not provision yet.",
      requester: "Requester",
      projectType: "internal_tool",
    },
    creator,
  );

  await service.submitIntake(intake.id, creator);

  await assert.rejects(
    () => service.generateProvisioningPlan(intake.id, { teamPrefix: "ds" }, devopsLead),
    ValidationError,
  );
});

test("request creators cannot complete discovery or self approve", async () => {
  const service = createService();
  const intake = await service.createIntake(
    {
      title: "Permission Test",
      description: "Permission boundaries.",
      requester: "Requester",
      projectType: "internal_tool",
    },
    creator,
  );

  await service.submitIntake(intake.id, creator);

  await assert.rejects(
    () => service.completeDiscovery(intake.id, { problemStatement: "x" }, creator),
    PermissionDeniedError,
  );
});

test("invalid repository plan stays dry-run and cannot be marked ready", async () => {
  const service = createService();
  const approved = await approveHappyPath(service);

  const planned = await service.generateProvisioningPlan(
    approved.id,
    {
      teamPrefix: "Digital Solutions",
      existingRepositoryNames: ["ds-tool-project-intake-os"],
    },
    devopsLead,
  );

  assert.equal(planned.provisioningPlan.validation.valid, false);
  assert.ok(planned.provisioningPlan.validation.errors.includes("repository_collision_detected"));
  assert.equal(planned.distributionPackage.validated, false);

  await assert.rejects(
    () => service.markReadyForProvisioning(approved.id, devopsLead),
    ValidationError,
  );
});

test("applyTransitionToRecord retries and recovers from a simulated compare-and-swap conflict (Q-CONC-1)", async () => {
  // Proves the retry path in applyTransitionToRecord: if another writer's save
  // races in between this caller's read and write, the CAS-guarded saveIntake
  // call returns null (simulated here rather than via real concurrency), and
  // the transition must re-read and retry instead of throwing or silently
  // clobbering the other writer's change.
  const store = new InMemoryProjectIntakeStore();
  const originalSaveIntake = store.saveIntake.bind(store);
  let casGuardedCalls = 0;
  store.saveIntake = async (record, options) => {
    if (options && casGuardedCalls++ === 0) {
      return null;
    }
    return originalSaveIntake(record, options);
  };

  let counter = 0;
  const service = new IntakeWorkflowService({
    store,
    clock: () => "2026-05-27T00:00:00.000Z",
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });

  const intake = await service.createIntake(
    {
      title: "Concurrent Write Regression",
      description: "Exercises the compare-and-swap retry path in applyTransitionToRecord.",
      requester: "Digital Solutions",
      department: "Internal Tools",
      projectType: "internal_tool",
    },
    creator,
  );

  const submitted = await service.submitIntake(intake.id, creator);

  assert.equal(submitted.status, "submitted");
  assert.equal(casGuardedCalls, 2, "first CAS attempt must have conflicted, second must have succeeded");
});

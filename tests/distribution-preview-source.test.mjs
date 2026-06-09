import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
  ValidationError,
} from "../dist/src/index.js";

const creator = { id: "user-creator", role: "request_creator", displayName: "Creator" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const devopsLead = { id: "user-devops", role: "devops_lead", displayName: "DevOps Lead" };

let counter = 0;

function createService() {
  counter = 0;
  return new IntakeWorkflowService({
    store: new InMemoryProjectIntakeStore(),
    clock: () => "2026-06-10T00:00:00.000Z",
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

async function createApprovedWithAcceptedDraft(service) {
  const intake = await service.createIntake(
    {
      title: "Client Analytics Dashboard",
      description: "Build an internal dashboard for stakeholders.",
      requester: "Digital Solutions",
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
  const gate1 = await service.recordApproval(accepted.id, {}, intakeOwner);
  return service.recordApproval(gate1.id, {}, devopsLead);
}

async function createApprovedWithRevisedDraft(service, overridePoints) {
  const intake = await service.createIntake(
    {
      title: "Internal Audit Tool",
      description: "A tool to track audit items and deadlines.",
      requester: "Audit Team",
      projectType: "internal_dashboard",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  const withDraft = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
  const humanPkg = {
    projectType: "internal_tool",
    complexity: "low",
    estimatedStoryPoints: overridePoints ?? 8,
    recommendedTechStack: ["Next.js", "Supabase"],
    infrastructureRequirements: ["GitHub repo", "Supabase project"],
    brief: {
      problem: "Audit team needs a centralised view.",
      solution: "Lightweight read-only dashboard.",
      scope: ["Dashboard MVP"],
      outOfScope: ["Real-time sync"],
    },
    subtasks: [
      { title: "Set up repo", description: "Scaffold project.", storyPoints: 2 },
      { title: "Build dashboard UI", description: "Main data view.", storyPoints: 5 },
    ],
    missingInformation: [],
  };
  const revised = await service.reviseAnalysisDraft(
    { intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id, reviewedPackage: humanPkg },
    intakeOwner,
  );
  const gate1 = await service.recordApproval(revised.id, {}, intakeOwner);
  return service.recordApproval(gate1.id, {}, devopsLead);
}

async function createApprovedNoAi(service) {
  const intake = await service.createIntake(
    {
      title: "Config Manager",
      description: "Manage environment configs across services.",
      requester: "DevOps Team",
      projectType: "internal_tool",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  const discovered = await service.completeDiscovery(submitted.id, { problemStatement: "Config drift is a problem." }, intakeOwner);
  const gate1 = await service.recordApproval(discovered.id, {}, intakeOwner);
  return service.recordApproval(gate1.id, {}, devopsLead);
}

// ── Test 1: Source is reviewed_project_package after accepting draft ───────────

test("provisioning plan source is reviewed_project_package when draft was accepted", async () => {
  const service = createService();
  const approved = await createApprovedWithAcceptedDraft(service);
  assert.ok(approved.reviewedProjectPackage, "reviewedProjectPackage should exist");

  const withPlan = await service.generateProvisioningPlan(
    approved.id,
    { teamPrefix: "Digital Solutions" },
    devopsLead,
  );

  assert.ok(withPlan.provisioningPlan, "provisioning plan should be created");
  assert.equal(withPlan.provisioningPlan.source.type, "reviewed_project_package");
  assert.equal(withPlan.provisioningPlan.source.sourceId, approved.reviewedProjectPackage.id);
  assert.equal(withPlan.provisioningPlan.source.reviewedBy, intakeOwner.id);
  assert.ok(withPlan.provisioningPlan.source.reviewedAt);
});

// ── Test 2: Human-revised values override AI draft values ─────────────────────

test("provisioning plan uses human-revised story points and subtask titles not raw AI draft", async () => {
  const service = createService();
  const approved = await createApprovedWithRevisedDraft(service, 8);

  const withPlan = await service.generateProvisioningPlan(
    approved.id,
    { teamPrefix: "Audit Team" },
    devopsLead,
  );

  const plan = withPlan.provisioningPlan;
  assert.ok(plan, "provisioning plan should be created");
  assert.equal(plan.source.type, "reviewed_project_package");

  // The revised package had 2 specific subtasks
  const issueAction = plan.actions.find((a) => a.action === "create_initial_issues");
  if (issueAction) {
    const titles = issueAction.payload.issueTitles;
    assert.ok(titles.includes("Set up repo"), "should include revised subtask title");
    assert.ok(titles.includes("Build dashboard UI"), "should include revised subtask title");
    // Must not be the generic AI-era hardcoded titles
    assert.ok(!titles.includes("Confirm approved scope and acceptance criteria"), "should not use generic hardcoded titles");
  }

  // Handoff doc action should contain revised story points
  const handoffAction = plan.actions.find((a) => a.action === "create_handoff_doc");
  assert.ok(handoffAction);
  assert.equal(handoffAction.payload.estimatedStoryPoints, 8);
  assert.equal(handoffAction.payload.sourceType, "reviewed_project_package");
});

// ── Test 3: Blocks preview for unreviewed AI draft ────────────────────────────

test("generateProvisioningPlan blocks if AI drafts exist but no reviewedProjectPackage", async () => {
  const service = createService();
  const intake = await service.createIntake(
    {
      title: "Unreviewed Project",
      description: "An intake with an unreviewed AI draft.",
      requester: "Team",
      projectType: "internal_tool",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  const withDraft = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);

  // AI draft exists but no reviewed package — should be blocked
  await assert.rejects(
    () => service.generateProvisioningPlan(withDraft.id, { teamPrefix: "Team" }, devopsLead),
    ValidationError,
  );

  const record = await service.getIntake(withDraft.id);
  assert.equal(record.provisioningPlan, undefined);
});

// ── Test 4: No-AI/manual path still works ─────────────────────────────────────

test("provisioning plan generates for no-AI intakes with manual_discovery or legacy source", async () => {
  const service = createService();
  const approved = await createApprovedNoAi(service);
  assert.equal(approved.analysisDrafts, undefined);
  assert.equal(approved.reviewedProjectPackage, undefined);

  const withPlan = await service.generateProvisioningPlan(
    approved.id,
    { teamPrefix: "DevOps Team" },
    devopsLead,
  );

  assert.ok(withPlan.provisioningPlan);
  assert.ok(
    withPlan.provisioningPlan.source.type === "manual_discovery" ||
      withPlan.provisioningPlan.source.type === "legacy_intake_record",
    `Expected manual source type, got: ${withPlan.provisioningPlan.source.type}`,
  );
});

// ── Test 5: Audit records sourceType and sourceId ─────────────────────────────

test("audit event for provisioning plan includes sourceType and sourceId", async () => {
  const service = createService();
  const approved = await createApprovedWithRevisedDraft(service, 13);

  const withPlan = await service.generateProvisioningPlan(
    approved.id,
    { teamPrefix: "Audit Team" },
    devopsLead,
  );

  const audit = await service.getAuditTrail(withPlan.id);
  const planEvent = audit.find((e) => e.action === "PROVISIONING_PLAN_GENERATED");
  assert.ok(planEvent, "PROVISIONING_PLAN_GENERATED event should exist");
  assert.equal(planEvent.metadata.sourceType, "reviewed_project_package");
  assert.equal(planEvent.metadata.sourceId, withPlan.provisioningPlan.source.sourceId);
});

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

async function createWithDraft(service) {
  const intake = await service.createIntake(
    {
      title: "Client Throughput Dashboard",
      description: "Build an internal dashboard for stakeholders to monitor project throughput, developer workload, and delivery timelines.",
      requester: "Digital Solutions",
      projectType: "internal_dashboard",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  return service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
}

async function createNoAiIntake(service) {
  const intake = await service.createIntake(
    {
      title: "Simple Config Tool",
      description: "A small utility for managing environment configs. No AI analysis needed.",
      requester: "DevOps Team",
      projectType: "internal_tool",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  // Use completeDiscovery (no-AI path) to reach intake_review without analysis drafts
  return service.completeDiscovery(submitted.id, { problemStatement: "Need a config management tool." }, intakeOwner);
}

// ── Test 1: Gate 1 blocked when AI draft exists but no reviewed package ────────

test("Gate 1 approval is blocked when AI draft exists but reviewedProjectPackage is missing", async () => {
  const service = createService();
  const withDraft = await createWithDraft(service);

  assert.equal(withDraft.analysisDrafts.length, 1);
  assert.equal(withDraft.reviewedProjectPackage, undefined);

  await assert.rejects(
    () => service.recordApproval(withDraft.id, { comment: "Looks good" }, intakeOwner),
    ValidationError,
  );

  // Intake remains in intake_review
  const record = await service.getIntake(withDraft.id, devopsLead);
  assert.equal(record.status, "intake_review");
  assert.equal(record.approvals.gate_1, undefined);
  assert.equal(record.provisioningPlan, undefined);
});

test("blocked approval error message explains the missing reviewed package", async () => {
  const service = createService();
  const withDraft = await createWithDraft(service);

  let errorMessage = "";
  try {
    await service.recordApproval(withDraft.id, {}, intakeOwner);
  } catch (err) {
    errorMessage = err.message;
  }

  assert.ok(
    errorMessage.toLowerCase().includes("reviewed project package") ||
      errorMessage.toLowerCase().includes("analysis draft"),
    `Error message should reference the reviewed package or analysis draft. Got: "${errorMessage}"`,
  );
});

// ── Test 2: Gate 1 allowed after accepting draft ──────────────────────────────

test("Gate 1 approval succeeds after accepting analysis draft", async () => {
  const service = createService();
  const withDraft = await createWithDraft(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  await service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId }, intakeOwner);

  const approved = await service.recordApproval(withDraft.id, { comment: "Review accepted." }, intakeOwner);

  assert.equal(approved.status, "devops_review");
  assert.equal(approved.approvals.gate_1.status, "approved");
  assert.ok(approved.reviewedProjectPackage, "reviewedProjectPackage should exist");
});

// ── Test 3: Gate 1 allowed after revising draft ───────────────────────────────

test("Gate 1 approval succeeds after revising analysis draft", async () => {
  const service = createService();
  const withDraft = await createWithDraft(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  const revisedPkg = {
    projectType: "internal_tool",
    complexity: "low",
    estimatedStoryPoints: 5,
    recommendedTechStack: ["Next.js"],
    infrastructureRequirements: [],
    brief: { problem: "x", solution: "y", scope: [], outOfScope: [] },
    subtasks: [],
    missingInformation: [],
  };
  await service.reviseAnalysisDraft(
    { intakeId: withDraft.id, draftId, reviewedPackage: revisedPkg, reviewerNotes: "Scope reduced." },
    intakeOwner,
  );

  const approved = await service.recordApproval(withDraft.id, {}, intakeOwner);

  assert.equal(approved.status, "devops_review");
  assert.equal(approved.approvals.gate_1.status, "approved");
  assert.ok(approved.reviewedProjectPackage);
  assert.equal(approved.reviewedProjectPackage.reviewDecision, "revised");
});

// ── Test 4: No-AI / manual approval path unchanged ────────────────────────────

test("Gate 1 approval succeeds when no AI analysis drafts exist", async () => {
  const service = createService();
  const submitted = await createNoAiIntake(service);

  // No analysis drafts, no reviewedProjectPackage — should still work
  assert.equal(submitted.analysisDrafts, undefined);
  assert.equal(submitted.reviewedProjectPackage, undefined);

  const approved = await service.recordApproval(submitted.id, { comment: "Manual intake approved." }, intakeOwner);

  assert.equal(approved.status, "devops_review");
  assert.equal(approved.approvals.gate_1.status, "approved");
});

// ── Test 5: Gate 2 behavior unchanged ────────────────────────────────────────

test("Gate 2 approval still requires Gate 1 and succeeds after it", async () => {
  const service = createService();
  const withDraft = await createWithDraft(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  // Complete the review gate so Gate 1 can proceed
  await service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId }, intakeOwner);
  const gate1 = await service.recordApproval(withDraft.id, {}, intakeOwner);
  assert.equal(gate1.status, "devops_review");

  const gate2 = await service.recordApproval(gate1.id, { comment: "DevOps approved." }, devopsLead);
  assert.equal(gate2.status, "approved");
  assert.equal(gate2.approvals.gate_1.status, "approved");
  assert.equal(gate2.approvals.gate_2.status, "approved");
});

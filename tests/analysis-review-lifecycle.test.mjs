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
const developer = { id: "user-dev", role: "developer", displayName: "Developer" };

let counter = 0;

function createService() {
  counter = 0;
  return new IntakeWorkflowService({
    store: new InMemoryProjectIntakeStore(),
    clock: () => "2026-06-10T00:00:00.000Z",
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

async function createDraftedIntake(service) {
  const intake = await service.createIntake(
    {
      title: "Client Throughput Dashboard",
      description:
        "Build an internal dashboard for stakeholders to monitor project throughput, developer workload, API data sources, and delivery timelines.",
      requester: "Digital Solutions",
      department: "Internal Tools",
      projectType: "internal_dashboard",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  return service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
}

// ── Test 1: Accept draft ──────────────────────────────────────────────────────

test("intake_owner can accept analysis draft and reviewed package is created", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  const reviewed = await service.acceptAnalysisDraft(
    { intakeId: withDraft.id, draftId, reviewerNotes: "Looks accurate for MVP planning." },
    intakeOwner,
  );

  // Reviewed package exists and is distinct from AI draft
  assert.ok(reviewed.reviewedProjectPackage, "reviewedProjectPackage should exist");
  assert.equal(reviewed.reviewedProjectPackage.sourceDraftId, draftId);
  assert.equal(reviewed.reviewedProjectPackage.reviewDecision, "accepted");
  assert.equal(reviewed.reviewedProjectPackage.reviewerNotes, "Looks accurate for MVP planning.");
  assert.equal(reviewed.reviewedProjectPackage.reviewedBy, intakeOwner.id);
  assert.ok(reviewed.reviewedProjectPackage.projectType);
  assert.ok(reviewed.reviewedProjectPackage.estimatedStoryPoints >= 1);
  assert.ok(reviewed.reviewedProjectPackage.subtasks.length >= 1);

  // Draft status is now accepted
  assert.equal(reviewed.latestAnalysisDraft.reviewStatus, "accepted");
  assert.equal(reviewed.analysisDrafts[0].reviewStatus, "accepted");

  // No approval or provisioning created
  assert.equal(reviewed.approvals.gate_1, undefined);
  assert.equal(reviewed.approvals.gate_2, undefined);
  assert.equal(reviewed.provisioningPlan, undefined);
  assert.equal(reviewed.distributionPackage, undefined);

  // Audit events written
  const audit = await service.getAuditTrail(withDraft.id, devopsLead);
  const actions = audit.map((e) => e.action);
  assert.ok(actions.includes("ANALYSIS_DRAFT_ACCEPTED"), "should have ANALYSIS_DRAFT_ACCEPTED");
  assert.ok(actions.includes("REVIEWED_PROJECT_PACKAGE_CREATED"), "should have REVIEWED_PROJECT_PACKAGE_CREATED");
  const acceptEvent = audit.find((e) => e.action === "ANALYSIS_DRAFT_ACCEPTED");
  assert.equal(acceptEvent.metadata.draftId, draftId);
});

// ── Test 2: Reject draft ──────────────────────────────────────────────────────

test("intake_owner can reject analysis draft with reason", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  const rejected = await service.rejectAnalysisDraft(
    {
      intakeId: withDraft.id,
      draftId,
      reason: "Missing client compliance requirements and data source details.",
    },
    intakeOwner,
  );

  // No reviewed package created
  assert.equal(rejected.reviewedProjectPackage, undefined);

  // Draft status is rejected
  assert.equal(rejected.latestAnalysisDraft.reviewStatus, "rejected");

  // Intake remains in intake_review
  assert.equal(rejected.status, "intake_review");

  // No approval or provisioning created
  assert.equal(rejected.approvals.gate_1, undefined);
  assert.equal(rejected.provisioningPlan, undefined);

  // Audit event written
  const audit = await service.getAuditTrail(withDraft.id, devopsLead);
  const actions = audit.map((e) => e.action);
  assert.ok(actions.includes("ANALYSIS_DRAFT_REJECTED"), "should have ANALYSIS_DRAFT_REJECTED");
  const rejectEvent = audit.find((e) => e.action === "ANALYSIS_DRAFT_REJECTED");
  assert.equal(rejectEvent.metadata.draftId, draftId);
  assert.equal(rejectEvent.metadata.reason, "Missing client compliance requirements and data source details.");
});

// ── Test 3: Revise draft ──────────────────────────────────────────────────────

test("reviewer can revise draft into a human-edited reviewed package", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  const draftId = withDraft.latestAnalysisDraft.id;
  const originalDraftContent = { ...withDraft.latestAnalysisDraft };

  const humanPackage = {
    projectType: "internal_tool",
    complexity: "medium",
    estimatedStoryPoints: 13,
    recommendedTechStack: ["Next.js", "NestJS", "Postgres"],
    infrastructureRequirements: ["GitHub repo", "Postgres database"],
    brief: {
      problem: "Throughput visibility is missing for stakeholders.",
      solution: "Build a lightweight internal dashboard backed by existing API data.",
      scope: ["Dashboard MVP", "GitHub integration"],
      outOfScope: ["Mobile app", "Real-time streaming"],
    },
    subtasks: [
      { title: "Set up project skeleton", description: "Create baseline app structure.", storyPoints: 2 },
      { title: "Implement dashboard view", description: "Build the main data view.", storyPoints: 5 },
    ],
    missingInformation: ["Final deadline"],
  };

  const revised = await service.reviseAnalysisDraft(
    { intakeId: withDraft.id, draftId, reviewedPackage: humanPackage, reviewerNotes: "Adjusted scope and story points." },
    intakeOwner,
  );

  // Reviewed package contains human-edited values
  assert.ok(revised.reviewedProjectPackage, "reviewedProjectPackage should exist");
  assert.equal(revised.reviewedProjectPackage.sourceDraftId, draftId);
  assert.equal(revised.reviewedProjectPackage.reviewDecision, "revised");
  assert.equal(revised.reviewedProjectPackage.projectType, "internal_tool");
  assert.equal(revised.reviewedProjectPackage.estimatedStoryPoints, 13);
  assert.deepEqual([...revised.reviewedProjectPackage.recommendedTechStack], ["Next.js", "NestJS", "Postgres"]);
  assert.equal(revised.reviewedProjectPackage.subtasks.length, 2);
  assert.equal(revised.reviewedProjectPackage.brief.problem, "Throughput visibility is missing for stakeholders.");

  // Original draft is now superseded, not mutated
  assert.equal(revised.latestAnalysisDraft.reviewStatus, "superseded");
  assert.equal(revised.analysisDrafts[0].reviewStatus, "superseded");
  // Original draft content preserved immutably
  assert.equal(revised.analysisDrafts[0].projectType, originalDraftContent.projectType);
  assert.equal(revised.analysisDrafts[0].estimatedStoryPoints, originalDraftContent.estimatedStoryPoints);

  // Audit events written
  const audit = await service.getAuditTrail(withDraft.id, devopsLead);
  const actions = audit.map((e) => e.action);
  assert.ok(actions.includes("ANALYSIS_DRAFT_REVISED"), "should have ANALYSIS_DRAFT_REVISED");
  assert.ok(actions.includes("REVIEWED_PROJECT_PACKAGE_CREATED"), "should have REVIEWED_PROJECT_PACKAGE_CREATED");
  const pkgEvent = audit.find((e) => e.action === "REVIEWED_PROJECT_PACKAGE_CREATED");
  assert.equal(pkgEvent.metadata.reviewDecision, "revised");
});

// ── Test 4: Unauthorized reviewer blocked ─────────────────────────────────────

test("request_creator cannot accept analysis draft", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  await assert.rejects(
    () => service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id }, creator),
    PermissionDeniedError,
  );
});

test("request_creator cannot reject analysis draft", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  await assert.rejects(
    () => service.rejectAnalysisDraft({ intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id, reason: "no" }, creator),
    PermissionDeniedError,
  );
});

test("developer cannot accept analysis draft", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  await assert.rejects(
    () => service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id }, developer),
    PermissionDeniedError,
  );
});

test("developer cannot revise analysis draft", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  const pkg = {
    projectType: "internal_tool",
    complexity: "low",
    estimatedStoryPoints: 5,
    recommendedTechStack: ["Next.js"],
    infrastructureRequirements: [],
    brief: { problem: "x", solution: "y", scope: [], outOfScope: [] },
    subtasks: [],
    missingInformation: [],
  };
  await assert.rejects(
    () => service.reviseAnalysisDraft({ intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id, reviewedPackage: pkg }, developer),
    PermissionDeniedError,
  );
});

// ── Test 5: AI cannot bypass governance ──────────────────────────────────────

test("accepting a draft does not approve intake or create provisioning plan", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  const accepted = await service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId }, intakeOwner);

  assert.equal(accepted.approvals.gate_1, undefined);
  assert.equal(accepted.approvals.gate_2, undefined);
  assert.equal(accepted.provisioningPlan, undefined);
  assert.ok(accepted.status !== "approved", "intake must not be auto-approved after draft acceptance");
  assert.ok(accepted.status !== "provisioning", "intake must not be in provisioning after draft acceptance");
});

test("revising a draft does not approve intake or create provisioning plan", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  const pkg = {
    projectType: "internal_tool",
    complexity: "low",
    estimatedStoryPoints: 5,
    recommendedTechStack: ["Next.js"],
    infrastructureRequirements: [],
    brief: { problem: "x", solution: "y", scope: [], outOfScope: [] },
    subtasks: [],
    missingInformation: [],
  };
  const revised = await service.reviseAnalysisDraft(
    { intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id, reviewedPackage: pkg },
    intakeOwner,
  );

  assert.equal(revised.approvals.gate_1, undefined);
  assert.equal(revised.approvals.gate_2, undefined);
  assert.equal(revised.provisioningPlan, undefined);
  assert.ok(revised.status !== "approved");
  assert.ok(revised.status !== "provisioning");
});

test("cannot review a draft that is not in pending state", async () => {
  const service = createService();
  const withDraft = await createDraftedIntake(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  // Accept once
  await service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId }, intakeOwner);

  // Try to accept again — draft is already accepted, not in draft state
  await assert.rejects(
    () => service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId }, intakeOwner),
    ValidationError,
  );
});

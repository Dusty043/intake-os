import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
  InvalidTransitionError,
  PermissionDeniedError,
  ValidationError,
  validateIntakeAnalysisDraft,
} from "../dist/src/index.js";

const creator = { id: "user-creator", role: "request_creator", displayName: "Creator" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const devopsLead = { id: "user-devops", role: "devops_lead", displayName: "DevOps Lead" };

function createService() {
  let counter = 0;
  return new IntakeWorkflowService({
    store: new InMemoryProjectIntakeStore(),
    clock: () => "2026-06-09T00:00:00.000Z",
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

async function createSubmittedIntake(service) {
  const intake = await service.createIntake(
    {
      title: "Client Throughput Dashboard",
      description:
        "Build an internal dashboard for stakeholders to monitor project throughput, developer workload, API data sources, and delivery timelines. Needs GitHub and database review.",
      requester: "Digital Solutions",
      department: "Internal Tools",
      projectType: "internal_dashboard",
    },
    creator,
  );

  return service.submitIntake(intake.id, creator);
}

test("mock AI analysis draft is generated as review-only state", async () => {
  const service = createService();
  const submitted = await createSubmittedIntake(service);

  const reviewed = await service.generateMockAnalysisDraft(
    submitted.id,
    {
      reviewerContext: "Keep this as a draft. Do not create Monday or GitHub resources yet.",
    },
    intakeOwner,
  );

  assert.equal(reviewed.status, "intake_review");
  assert.equal(reviewed.approvals.gate_1, undefined);
  assert.equal(reviewed.approvals.gate_2, undefined);
  assert.equal(reviewed.provisioningPlan, undefined);
  assert.equal(reviewed.distributionPackage, undefined);
  assert.equal(reviewed.analysisDrafts.length, 1);
  assert.equal(reviewed.latestAnalysisDraft.id, reviewed.analysisDrafts[0].id);
  assert.equal(reviewed.latestAnalysisDraft.provider, "mock");
  assert.equal(reviewed.latestAnalysisDraft.reviewStatus, "draft");
  assert.equal(reviewed.latestAnalysisDraft.schemaVersion, "intake-analysis-draft.v1");
  assert.equal(reviewed.latestAnalysisDraft.projectType, "internal_dashboard");
  assert.ok(reviewed.latestAnalysisDraft.estimatedStoryPoints >= 1);
  assert.ok(reviewed.latestAnalysisDraft.confidence > 0);
  assert.ok(reviewed.latestAnalysisDraft.subtasks.length >= 3);
  assert.ok(reviewed.latestAnalysisDraft.infrastructureRequirements.some((item) => item.kind === "github_repository"));
  assert.ok(reviewed.latestAnalysisDraft.requiredEvaluationSections.includes("architecture_sketch"));
  assert.deepEqual(validateIntakeAnalysisDraft(reviewed.latestAnalysisDraft), { valid: true, errors: [] });

  const audit = await service.getAuditTrail(reviewed.id, devopsLead);
  assert.deepEqual(
    audit.map((event) => event.action),
    ["INTAKE_CREATED", "submit", "generate_evaluation", "ANALYSIS_DRAFT_GENERATED", "success"],
  );
  assert.equal(audit[3].metadata.draftOnly, true);
});

test("calling generateMockAnalysisDraft again after the draft is ready is an idempotent no-op", async () => {
  // Regression for the discovery-to-intake handoff: send-to-evaluation fires
  // generateMockAnalysisDraft in the background, unawaited. If a second call
  // (a manual "Generate Mock AI Draft" click racing it, or a retried request)
  // lands after the draft is already ready, it used to throw
  // InvalidTransitionError because "generate_evaluation" only transitions
  // from "submitted" — not from "intake_review".
  const service = createService();
  const submitted = await createSubmittedIntake(service);
  const ready = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
  assert.equal(ready.status, "intake_review");

  const repeated = await service.generateMockAnalysisDraft(ready.id, {}, intakeOwner);

  assert.equal(repeated.status, "intake_review");
  assert.equal(repeated.analysisDrafts.length, 1);
  assert.equal(repeated.latestAnalysisDraft.id, ready.latestAnalysisDraft.id);
});

test("mock analysis cannot bypass approval or provisioning gates", async () => {
  const service = createService();
  const submitted = await createSubmittedIntake(service);
  const withDraft = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);

  await assert.rejects(
    () => service.generateProvisioningPlan(withDraft.id, { teamPrefix: "Digital Solutions" }, devopsLead),
    ValidationError,
  );

  // TASK-0007: must accept the draft before Gate 1 approval is allowed
  const draftAccepted = await service.acceptAnalysisDraft(
    { intakeId: withDraft.id, draftId: withDraft.latestAnalysisDraft.id, reviewerNotes: "Confirmed." },
    intakeOwner,
  );

  const gate1 = await service.recordApproval(draftAccepted.id, { comment: "Review accepted." }, intakeOwner);
  assert.equal(gate1.status, "devops_review");
  assert.equal(gate1.approvals.gate_1.status, "approved");
  assert.equal(gate1.provisioningPlan, undefined);
});

test("only evaluation-capable actors can generate mock analysis drafts", async () => {
  const service = createService();
  const submitted = await createSubmittedIntake(service);

  await assert.rejects(
    () => service.generateMockAnalysisDraft(submitted.id, {}, creator),
    PermissionDeniedError,
  );
});

test("mock analysis draft generation requires submitted state", async () => {
  const service = createService();
  const draft = await service.createIntake(
    {
      title: "Draft Intake",
      description: "Not submitted yet.",
      requester: "Requester",
      projectType: "internal_tool",
    },
    creator,
  );

  await assert.rejects(
    () => service.generateMockAnalysisDraft(draft.id, {}, intakeOwner),
    InvalidTransitionError,
  );
});

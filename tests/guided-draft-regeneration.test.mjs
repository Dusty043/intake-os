import assert from "node:assert/strict";
import test from "node:test";
import {
  ConflictError,
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
    clock: () => "2026-06-12T00:00:00.000Z",
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

async function createIntakeWithDraft(service) {
  const intake = await service.createIntake(
    {
      title: "Payment Retry System",
      description:
        "Build a backend service for retrying failed payment transactions with exponential backoff, audit logging, and stakeholder notifications.",
      requester: "Finance Team",
      department: "Engineering",
      projectType: "api_service",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  return service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
}

const GUIDANCE = "Focus on the payment retry logic, not the UI layer";

// ── Test 1: intake_owner can regenerate ───────────────────────────────────────

test("intake_owner can submit guidance and get a new draft", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);
  const originalDraftId = withDraft.latestAnalysisDraft.id;

  const result = await service.regenerateAnalysisDraft(
    withDraft.id,
    { guidance: GUIDANCE, requestedBy: intakeOwner.displayName },
    intakeOwner,
  );

  assert.ok(result.latestAnalysisDraft, "should have a latest draft");
  assert.notEqual(result.latestAnalysisDraft.id, originalDraftId, "new draft should have a different id");
  assert.equal(result.latestAnalysisDraft.reviewStatus, "draft", "new draft should be in pending review");
  assert.equal(result.analysisDraftRegenerationCount, 1, "regen count should be 1");
});

// ── Test 2: devops_lead can regenerate ────────────────────────────────────────

test("devops_lead can submit guidance and get a new draft", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);

  const result = await service.regenerateAnalysisDraft(
    withDraft.id,
    { guidance: "Reduce scope to backend only, two sprints max", requestedBy: devopsLead.displayName },
    devopsLead,
  );

  assert.ok(result.latestAnalysisDraft);
  assert.equal(result.latestAnalysisDraft.reviewStatus, "draft");
  assert.equal(result.analysisDraftRegenerationCount, 1);
});

// ── Test 3: request_creator cannot regenerate ─────────────────────────────────

test("request_creator cannot steer draft regeneration", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);

  await assert.rejects(
    () => service.regenerateAnalysisDraft(withDraft.id, { guidance: GUIDANCE, requestedBy: creator.displayName }, creator),
    (err) => err instanceof PermissionDeniedError,
  );
});

// ── Test 4: developer cannot regenerate ──────────────────────────────────────

test("developer cannot steer draft regeneration", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);

  await assert.rejects(
    () => service.regenerateAnalysisDraft(withDraft.id, { guidance: GUIDANCE, requestedBy: developer.displayName }, developer),
    (err) => err instanceof PermissionDeniedError,
  );
});

// ── Test 5: prior draft is superseded ────────────────────────────────────────

test("regeneration supersedes the previous draft", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);
  const originalDraftId = withDraft.latestAnalysisDraft.id;

  const result = await service.regenerateAnalysisDraft(
    withDraft.id,
    { guidance: GUIDANCE, requestedBy: intakeOwner.displayName },
    intakeOwner,
  );

  const originalDraft = result.analysisDrafts.find((d) => d.id === originalDraftId);
  assert.ok(originalDraft, "original draft should still be present");
  assert.equal(originalDraft.reviewStatus, "superseded", "original draft should be superseded");
  assert.equal(result.latestAnalysisDraft.reviewStatus, "draft", "new draft should be pending");
  assert.equal(result.analysisDrafts.length, 2, "should have two drafts total");
});

// ── Test 6: count increments ──────────────────────────────────────────────────

test("regeneration count increments on each call", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);

  const r1 = await service.regenerateAnalysisDraft(
    withDraft.id,
    { guidance: GUIDANCE, requestedBy: intakeOwner.displayName },
    intakeOwner,
  );
  assert.equal(r1.analysisDraftRegenerationCount, 1);

  const r2 = await service.regenerateAnalysisDraft(
    r1.id,
    { guidance: "Also consider auth and rate limiting", requestedBy: devopsLead.displayName },
    devopsLead,
  );
  assert.equal(r2.analysisDraftRegenerationCount, 2);
});

// ── Test 7: blocked after limit ───────────────────────────────────────────────

test("regeneration is blocked after limit is reached", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);
  let current = withDraft;

  for (let i = 1; i <= 5; i++) {
    current = await service.regenerateAnalysisDraft(
      current.id,
      { guidance: `Iteration ${i} guidance text here`, requestedBy: intakeOwner.displayName },
      intakeOwner,
    );
    assert.equal(current.analysisDraftRegenerationCount, i);
  }

  await assert.rejects(
    () =>
      service.regenerateAnalysisDraft(
        current.id,
        { guidance: "One more attempt beyond the limit", requestedBy: intakeOwner.displayName },
        intakeOwner,
      ),
    (err) => err instanceof ConflictError && err.message.includes("limit"),
  );
});

// ── Test 8: requires a draft in pending state ─────────────────────────────────

test("regeneration requires a draft in pending_review state", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);
  const draftId = withDraft.latestAnalysisDraft.id;

  // Accept the draft so there's no pending one
  await service.acceptAnalysisDraft({ intakeId: withDraft.id, draftId }, intakeOwner);

  await assert.rejects(
    () =>
      service.regenerateAnalysisDraft(
        withDraft.id,
        { guidance: GUIDANCE, requestedBy: intakeOwner.displayName },
        intakeOwner,
      ),
    (err) => err instanceof ConflictError,
  );
});

// ── Test 9: audit event is emitted ───────────────────────────────────────────

test("regeneration audit event includes guidance summary and count", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);
  const guidance = "Focus on the payment retry logic, not the UI layer";

  await service.regenerateAnalysisDraft(
    withDraft.id,
    { guidance, requestedBy: intakeOwner.displayName },
    intakeOwner,
  );

  const audit = await service.getAuditTrail(withDraft.id);
  const regenEvent = audit.find((e) => e.action === "ANALYSIS_DRAFT_REGENERATED");
  assert.ok(regenEvent, "ANALYSIS_DRAFT_REGENERATED event should exist");
  assert.equal(regenEvent.metadata.regenerationCount, 1);
  assert.equal(regenEvent.metadata.guidance, guidance);
  assert.equal(regenEvent.metadata.requestedBy, intakeOwner.displayName);
  assert.ok(regenEvent.metadata.newDraftId);
  assert.ok(regenEvent.metadata.previousDraftId);
});

// ── Test 10: guidance minimum length enforced ─────────────────────────────────

test("guidance shorter than 10 chars is rejected", async () => {
  const service = createService();
  const withDraft = await createIntakeWithDraft(service);

  await assert.rejects(
    () =>
      service.regenerateAnalysisDraft(
        withDraft.id,
        { guidance: "short", requestedBy: intakeOwner.displayName },
        intakeOwner,
      ),
    (err) => err instanceof ValidationError,
  );
});

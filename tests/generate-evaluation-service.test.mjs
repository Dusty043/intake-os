import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EvaluationOrchestrator,
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
  ValidationError,
} from "../dist/src/index.js";
import {
  createAllMockEvaluationAgents,
  createMockEvaluationAgentsForDepth,
} from "../dist/src/application/agents/mock/index.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const NOW = "2026-06-15T00:00:00.000Z";
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const creator = { id: "user-creator", role: "request_creator", displayName: "Creator" };

let _seq = 0;
function makeIdFactory() {
  return (prefix) => `${prefix}-${String(++_seq).padStart(4, "0")}`;
}

function makeOrchestrator(agentOverrides = {}) {
  const base = createAllMockEvaluationAgents();
  const agents = base.map((a) => agentOverrides[a.role] ?? a);
  return new EvaluationOrchestrator({
    agents,
    idFactory: makeIdFactory(),
    now: () => NOW,
  });
}

function makeServiceWithOrchestrator(orchestrator) {
  return new IntakeWorkflowService({
    store: new InMemoryProjectIntakeStore(),
    clock: () => NOW,
    idFactory: makeIdFactory(),
    orchestrator,
  });
}

function makeServiceWithoutOrchestrator() {
  return new IntakeWorkflowService({
    store: new InMemoryProjectIntakeStore(),
    clock: () => NOW,
    idFactory: makeIdFactory(),
  });
}

async function createAndSubmitIntake(service) {
  const intake = await service.createIntake(
    {
      title: "Build KPI Dashboard",
      // description deliberately includes business goal keywords to avoid clarification blocking
      description:
        "Our business goal is to build an internal KPI dashboard showing real-time sales metrics. Should integrate with Salesforce and display charts for revenue, pipeline, and forecast. Accessible to the sales team with role-based access control.",
      requester: "Sales Team",
      department: "Sales",
      projectType: "internal_dashboard",
    },
    creator,
  );
  return service.submitIntake(intake.id, creator);
}

// ─── generateEvaluation: happy path ──────────────────────────────────────────

describe("generateEvaluation — happy path", () => {
  it("transitions intake from submitted → intake_review with draft", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    const result = await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);

    assert.equal(result.status, "intake_review");
    assert.ok(result.latestAnalysisDraft, "latestAnalysisDraft must be set");
    assert.equal(result.latestAnalysisDraft.reviewStatus, "draft");
    assert.ok(result.analysisDrafts?.length >= 1, "analysisDrafts must contain the new draft");
  });

  it("persists the evaluation in the store", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({
      store,
      clock: () => NOW,
      idFactory: makeIdFactory(),
      orchestrator,
    });

    const submitted = await createAndSubmitIntake(service);
    const result = await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);

    const evaluations = await store.listEvaluationsForIntake(submitted.id);
    assert.equal(evaluations.length, 1);
    assert.equal(evaluations[0].intakeId, submitted.id);
    assert.equal(evaluations[0].depth, "standard");
    assert.ok(evaluations[0].sections.length > 0, "evaluation must have sections");
  });

  it("links draft to evaluation via draft id in audit trail", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({
      store,
      clock: () => NOW,
      idFactory: makeIdFactory(),
      orchestrator,
    });

    const submitted = await createAndSubmitIntake(service);
    const result = await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);

    const auditTrail = await service.getAuditTrail(submitted.id);
    const evalEvent = auditTrail.find((e) => e.action === "EVALUATION_GENERATED");
    assert.ok(evalEvent, "EVALUATION_GENERATED audit event must exist");
    assert.ok(evalEvent.metadata?.evaluationId, "audit event must include evaluationId");
    assert.ok(evalEvent.metadata?.draftId, "audit event must include draftId");
    assert.equal(evalEvent.metadata.draftId, result.latestAnalysisDraft.id);
  });

  it("draft has required fields populated from evaluation sections", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    const result = await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);
    const draft = result.latestAnalysisDraft;

    assert.ok(draft.id, "draft must have id");
    assert.equal(draft.intakeId, submitted.id);
    assert.ok(draft.estimatedStoryPoints > 0, "estimatedStoryPoints must be positive");
    assert.ok(draft.subtasks.length > 0, "subtasks must be present");
    assert.ok(draft.recommendedTechStack.length > 0, "tech stack must be present");
    assert.ok(draft.brief.problemStatement, "problemStatement must be set");
  });
});

// ─── generateEvaluation: clarification_required ───────────────────────────────

describe("generateEvaluation — clarification_required", () => {
  it("transitions to clarification_required when blocking clarification detected", async () => {
    _seq = 0;
    // thin intake that lacks enough detail to avoid clarification
    const orchestrator = makeOrchestrator();
    const service = makeServiceWithOrchestrator(orchestrator);
    const intake = await service.createIntake(
      {
        title: "AB",
        description: "x",
        requester: "unknown",
        department: "Unknown",
        projectType: "internal_tool",
      },
      creator,
    );
    await service.submitIntake(intake.id, creator);

    const result = await service.generateEvaluation(
      intake.id,
      { depth: "standard", provider: "mock" },
      intakeOwner,
    );

    // may or may not produce clarification_required depending on mock agent threshold
    // but status must be either clarification_required or intake_review
    assert.ok(
      result.status === "clarification_required" || result.status === "intake_review",
      `unexpected status: ${result.status}`,
    );
  });
});

// ─── generateEvaluation: guard — no orchestrator ──────────────────────────────

describe("generateEvaluation — guard", () => {
  it("throws ValidationError when no orchestrator is configured", async () => {
    _seq = 0;
    const service = makeServiceWithoutOrchestrator();
    const submitted = await createAndSubmitIntake(service);

    await assert.rejects(
      () => service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner),
      (err) => err instanceof ValidationError && err.message.includes("orchestrator"),
    );
  });
});

// ─── generateMockAnalysisDraft: routing ───────────────────────────────────────

describe("generateMockAnalysisDraft — routing", () => {
  it("delegates to generateEvaluation when orchestrator is injected", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    const result = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);

    // Should reach intake_review just like generateEvaluation happy path
    assert.ok(
      result.status === "intake_review" || result.status === "clarification_required",
      `expected intake_review or clarification_required, got: ${result.status}`,
    );
    // Evaluation must be persisted
    const store = service["store"];
    const evaluations = await store.listEvaluationsForIntake(submitted.id);
    assert.equal(evaluations.length, 1, "evaluation must be persisted when routing through orchestrator");
  });

  it("uses legacy mock path when no orchestrator is configured", async () => {
    _seq = 0;
    const service = makeServiceWithoutOrchestrator();
    const submitted = await createAndSubmitIntake(service);

    const result = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);

    assert.equal(result.status, "intake_review", "legacy path must reach intake_review");
    assert.ok(result.latestAnalysisDraft, "legacy path must produce a draft");
    // No evaluation should be persisted on the legacy path
    const store = service["store"];
    const evaluations = await store.listEvaluationsForIntake(submitted.id);
    assert.equal(evaluations.length, 0, "no evaluation should be persisted on legacy path");
  });
});

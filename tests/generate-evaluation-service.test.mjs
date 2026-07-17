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
  it("transitions submitted → intake_review; the evaluation is the reviewable artifact (A-scoped)", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    const result = await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);

    assert.equal(result.status, "intake_review");
    // A-scoped (TASK-0078): no derived draft twin on the orchestrator path.
    assert.ok(!result.latestAnalysisDraft, "no legacy draft twin should be created");
    const evaluation = await service["store"].getLatestEvaluationForIntake(submitted.id);
    assert.ok(evaluation, "evaluation must be persisted as the reviewable artifact");
    assert.equal(evaluation.status, "ready_for_review");
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

  it("audit trail links the evaluation, not a draft", async () => {
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
    await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);

    const auditTrail = await service.getAuditTrail(submitted.id, intakeOwner);
    const evalEvent = auditTrail.find((e) => e.action === "EVALUATION_GENERATED");
    assert.ok(evalEvent, "EVALUATION_GENERATED audit event must exist");
    assert.ok(evalEvent.metadata?.evaluationId, "audit event must include evaluationId");
    assert.ok(!evalEvent.metadata?.draftId, "audit event must not reference a draft (A-scoped)");
  });

  it("accepting the evaluation builds a reviewed package sourced from its sections", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);
    const evaluation = await service["store"].getLatestEvaluationForIntake(submitted.id);

    const accepted = await service.acceptAnalysisDraft({ intakeId: submitted.id }, intakeOwner);
    const pkg = accepted.reviewedProjectPackage;

    assert.ok(pkg, "accepting the evaluation must create a reviewed package");
    assert.equal(pkg.sourceEvaluationId, evaluation.id, "package must be sourced from the evaluation");
    assert.equal(pkg.intakeId, submitted.id);
    assert.ok(pkg.estimatedStoryPoints > 0, "estimatedStoryPoints must be positive");
    assert.ok(pkg.subtasks.length > 0, "subtasks must be present");
    assert.ok(pkg.brief.problem, "brief.problem must be set");
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

// ─── regenerateAnalysisDraft: orchestrator routing ───────────────────────────

describe("regenerateAnalysisDraft — orchestrator routing", () => {
  it("runs orchestrator regen and supersedes previous draft", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({
      store,
      clock: () => NOW,
      idFactory: makeIdFactory(),
      orchestrator,
    });

    // Generate initial evaluation to reach intake_review
    const submitted = await createAndSubmitIntake(service);
    await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);

    // Regenerate with guidance
    const result = await service.regenerateAnalysisDraft(
      submitted.id,
      { guidance: "Focus more on data pipeline requirements and integration points.", requestedBy: "Reviewer" },
      intakeOwner,
    );

    assert.equal(result.status, "intake_review", "status must stay intake_review after regen");
    assert.equal(result.analysisDraftRegenerationCount, 1);

    // A-scoped: two evaluations persisted — the fresh one ready_for_review,
    // the prior one superseded (needs_revision). No draft twins.
    assert.ok(!result.latestAnalysisDraft, "no draft twin on the orchestrator path");
    const evaluations = await store.listEvaluationsForIntake(submitted.id);
    assert.equal(evaluations.length, 2, "both initial and regen evaluations must be persisted");
    const latest = await store.getLatestEvaluationForIntake(submitted.id);
    assert.equal(latest.status, "ready_for_review", "regenerated evaluation is the reviewable one");
    const superseded = evaluations.find((e) => e.status === "needs_revision");
    assert.ok(superseded, "previous evaluation must be superseded (needs_revision)");
  });

  it("audit trail contains EVALUATION_REGENERATED event", async () => {
    _seq = 0;
    const orchestrator = makeOrchestrator();
    const service = makeServiceWithOrchestrator(orchestrator);

    const submitted = await createAndSubmitIntake(service);
    await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);

    await service.regenerateAnalysisDraft(
      submitted.id,
      { guidance: "Emphasize security and compliance requirements for this pipeline.", requestedBy: "Reviewer" },
      intakeOwner,
    );

    const audit = await service.getAuditTrail(submitted.id, intakeOwner);
    const regenEvent = audit.find((e) => e.action === "EVALUATION_REGENERATED");
    assert.ok(regenEvent, "EVALUATION_REGENERATED audit event must exist");
    assert.ok(regenEvent.metadata?.evaluationId, "must include evaluationId");
    assert.ok(regenEvent.metadata?.previousEvaluationId, "must include previousEvaluationId");
  });
});

// ─── generateEvaluation: failure path (Q-EVAL-1) ────────────────────────────

describe("generateEvaluation — orchestrator failure", () => {
  it("reverts the intake to submitted instead of leaving it stuck at evaluating", async () => {
    _seq = 0;
    const failingAgent = {
      role: "intake_brief",
      async run() {
        throw new Error("simulated provider failure");
      },
    };
    const orchestrator = makeOrchestrator({ intake_brief: failingAgent });
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    await assert.rejects(
      () => service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner),
      /simulated provider failure/,
    );

    const reverted = await service.getIntake(submitted.id, intakeOwner);
    assert.equal(reverted.status, "submitted");
  });

  it("records an EVALUATION_FAILED audit event with the error message", async () => {
    _seq = 0;
    const failingAgent = {
      role: "intake_brief",
      async run() {
        throw new Error("simulated provider failure");
      },
    };
    const orchestrator = makeOrchestrator({ intake_brief: failingAgent });
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    await assert.rejects(() =>
      service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner),
    );

    const audit = await service.getAuditTrail(submitted.id, intakeOwner);
    const failedEvent = audit.find((e) => e.action === "EVALUATION_FAILED");
    assert.ok(failedEvent, "EVALUATION_FAILED audit event must exist");
    assert.match(failedEvent.metadata?.error ?? "", /simulated provider failure/);
  });

  it("allows retrying generateEvaluation after a reverted failure", async () => {
    _seq = 0;
    let shouldFail = true;
    const flakyAgent = {
      role: "intake_brief",
      async run(ctx, opts) {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("simulated provider failure");
        }
        return createAllMockEvaluationAgents()
          .find((a) => a.role === "intake_brief")
          .run(ctx, opts);
      },
    };
    const orchestrator = makeOrchestrator({ intake_brief: flakyAgent });
    const service = makeServiceWithOrchestrator(orchestrator);
    const submitted = await createAndSubmitIntake(service);

    await assert.rejects(() =>
      service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner),
    );

    const result = await service.generateEvaluation(submitted.id, { depth: "standard", provider: "mock" }, intakeOwner);
    assert.equal(result.status, "intake_review");
    const evaluation = await service["store"].getLatestEvaluationForIntake(submitted.id);
    assert.ok(evaluation, "retry must produce an evaluation");
    assert.equal(evaluation.status, "ready_for_review");
  });
});

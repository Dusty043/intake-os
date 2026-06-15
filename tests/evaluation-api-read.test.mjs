import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EvaluationOrchestrator,
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
} from "../dist/src/index.js";
import { createAllMockEvaluationAgents } from "../dist/src/application/agents/mock/index.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const NOW = "2026-06-16T00:00:00.000Z";
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const creator = { id: "user-creator", role: "request_creator", displayName: "Creator" };

let _seq = 0;
function makeIdFactory() {
  return (prefix) => `${prefix}-${String(++_seq).padStart(4, "0")}`;
}

function makeService() {
  const orchestrator = new EvaluationOrchestrator({
    agents: createAllMockEvaluationAgents(),
    idFactory: makeIdFactory(),
    now: () => NOW,
  });
  const store = new InMemoryProjectIntakeStore();
  const service = new IntakeWorkflowService({
    store,
    clock: () => NOW,
    idFactory: makeIdFactory(),
    orchestrator,
  });
  return { service, store };
}

async function createAndEvaluate(service) {
  const intake = await service.createIntake(
    {
      title: "Evaluation Read Test",
      description:
        "Our business goal is to build an internal KPI dashboard showing real-time sales metrics, integrated with Salesforce for revenue and pipeline tracking.",
      requester: "Sales Team",
      department: "Sales",
      projectType: "internal_dashboard",
    },
    creator,
  );
  const submitted = await service.submitIntake(intake.id, creator);
  const result = await service.generateEvaluation(
    submitted.id,
    { depth: "standard", provider: "mock" },
    intakeOwner,
  );
  return result;
}

// ─── listEvaluationsForIntake ─────────────────────────────────────────────────

describe("listEvaluationsForIntake", () => {
  it("returns empty array when no evaluation exists", async () => {
    _seq = 0;
    const { service } = makeService();
    const intake = await service.createIntake(
      { title: "Empty", description: "No eval yet", requester: "A", projectType: "internal_tool" },
      creator,
    );
    const evals = await service.listEvaluationsForIntake(intake.id);
    assert.equal(evals.length, 0);
  });

  it("returns evaluations newest first after one generation", async () => {
    _seq = 0;
    const { service } = makeService();
    const intakeRecord = await createAndEvaluate(service);
    const evals = await service.listEvaluationsForIntake(intakeRecord.id);
    assert.ok(evals.length >= 1, "at least one evaluation should be listed");
    assert.equal(evals[0].intakeId, intakeRecord.id);
    assert.ok(evals[0].sections.length > 0, "evaluation must have sections");
  });

  it("returns two evaluations after regeneration", async () => {
    _seq = 0;
    const { service } = makeService();
    const intakeRecord = await createAndEvaluate(service);
    await service.regenerateAnalysisDraft(
      intakeRecord.id,
      { guidance: "Focus more on the data pipeline integration points.", requestedBy: "Reviewer" },
      intakeOwner,
    );
    const evals = await service.listEvaluationsForIntake(intakeRecord.id);
    assert.equal(evals.length, 2, "two evaluations after regen");
  });
});

// ─── getLatestEvaluationForIntake ─────────────────────────────────────────────

describe("getLatestEvaluationForIntake", () => {
  it("returns null evaluation when no evaluation exists", async () => {
    _seq = 0;
    const { service } = makeService();
    const intake = await service.createIntake(
      { title: "Empty", description: "No eval yet", requester: "B", projectType: "internal_tool" },
      creator,
    );
    const { evaluation, agentRuns } = await service.getLatestEvaluationForIntake(intake.id);
    assert.equal(evaluation, null);
    assert.deepEqual(agentRuns, []);
  });

  it("returns latest evaluation with agent runs", async () => {
    _seq = 0;
    const { service } = makeService();
    const intakeRecord = await createAndEvaluate(service);
    const { evaluation, agentRuns } = await service.getLatestEvaluationForIntake(intakeRecord.id);
    assert.ok(evaluation !== null, "evaluation must be returned");
    assert.equal(evaluation.intakeId, intakeRecord.id);
    assert.ok(evaluation.sections.length > 0, "evaluation must have sections");
    assert.ok(Array.isArray(agentRuns), "agentRuns must be an array");
  });
});

// ─── getEvaluationForIntake ───────────────────────────────────────────────────

describe("getEvaluationForIntake", () => {
  it("returns evaluation by ID with sections and quality score", async () => {
    _seq = 0;
    const { service } = makeService();
    const intakeRecord = await createAndEvaluate(service);
    const evals = await service.listEvaluationsForIntake(intakeRecord.id);
    const evalId = evals[0].id;

    const { evaluation, agentRuns } = await service.getEvaluationForIntake(intakeRecord.id, evalId);
    assert.equal(evaluation.id, evalId);
    assert.equal(evaluation.intakeId, intakeRecord.id);
    assert.ok(evaluation.sections.length > 0);
    assert.ok(Array.isArray(agentRuns));
  });

  it("throws NotFoundError when evaluation ID does not belong to intake", async () => {
    _seq = 0;
    const { service } = makeService();
    const intakeRecord = await createAndEvaluate(service);
    await assert.rejects(
      () => service.getEvaluationForIntake(intakeRecord.id, "NONEXISTENT-ID"),
      (err) => err.constructor.name === "NotFoundError" || err.message.includes("NONEXISTENT"),
    );
  });

  it("includes agent runs for the evaluation", async () => {
    _seq = 0;
    const { service } = makeService();
    const intakeRecord = await createAndEvaluate(service);
    const evals = await service.listEvaluationsForIntake(intakeRecord.id);
    const { agentRuns } = await service.getEvaluationForIntake(intakeRecord.id, evals[0].id);
    assert.ok(agentRuns.length > 0, "agent runs must be populated for a completed evaluation");
  });
});

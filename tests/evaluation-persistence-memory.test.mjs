import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { InMemoryProjectIntakeStore } from "../dist/src/application/in-memory-store.js";
import { EvaluationOrchestrator } from "../dist/src/application/evaluation-orchestrator.js";
import { createAllMockEvaluationAgents } from "../dist/src/application/agents/mock/index.js";
import { agentRunsFromEvaluation } from "../dist/src/application/evaluation-persistence.js";
import { evaluationToLegacyDraft } from "../dist/src/application/evaluation-draft-mapper.js";
import { validateIntakeAnalysisDraft } from "../dist/src/application/intake-analysis.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const NOW_A = "2026-06-12T10:00:00.000Z";
const NOW_B = "2026-06-12T11:00:00.000Z";
const ACTOR = { id: "USER-001", role: "admin", displayName: "Test Admin" };

let _counter = 0;
const testIdFactory = (prefix) => `${prefix}-${String(++_counter).padStart(4, "0")}`;

function makeOrchestrator() {
  return new EvaluationOrchestrator({
    agents: createAllMockEvaluationAgents(),
    idFactory: testIdFactory,
    now: () => NOW_A,
  });
}

function makeIntake(id = "INTAKE-001", overrides = {}) {
  return {
    id,
    title: "Build a KPI dashboard for the sales team",
    description:
      "Our business goal is to build an internal dashboard showing real-time sales KPIs. Integrate with Salesforce and display charts for revenue, pipeline, and forecast with role-based access control.",
    requester: "alice@example.com",
    department: "Sales",
    projectType: "internal_dashboard",
    status: "submitted",
    createdAt: NOW_A,
    createdBy: ACTOR,
    source: { system: "manual" },
    externalLinks: [],
    ...overrides,
  };
}

// ─── Shared evaluation produced before tests run ──────────────────────────────

let evaluationA;
let evaluationB;

before(async () => {
  const orch = makeOrchestrator();
  const resultA = await orch.orchestrate(makeIntake("INTAKE-001"), {
    actor: ACTOR,
    depth: "standard",
    provider: "mock",
    allowDepthUpgrade: false,
  });
  assert.equal(resultA.kind, "evaluation_ready", "setup: expected evaluation_ready");
  evaluationA = resultA.evaluation;

  // Second evaluation for same intake (newer timestamp)
  const orchB = new EvaluationOrchestrator({
    agents: createAllMockEvaluationAgents(),
    idFactory: testIdFactory,
    now: () => NOW_B,
  });
  const resultB = await orchB.orchestrate(makeIntake("INTAKE-001"), {
    actor: ACTOR,
    depth: "standard",
    provider: "mock",
    allowDepthUpgrade: false,
  });
  assert.equal(resultB.kind, "evaluation_ready", "setup: expected evaluation_ready (B)");
  evaluationB = { ...resultB.evaluation, id: "eval-B-override" };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InMemoryProjectIntakeStore — evaluation persistence", () => {
  it("saveEvaluation stores evaluation and derives agent runs", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });

    const saved = await store.getEvaluation(evaluationA.intakeId, evaluationA.id);
    assert.ok(saved, "evaluation should be retrievable after save");
    assert.equal(saved.id, evaluationA.id);
    assert.equal(saved.intakeId, evaluationA.intakeId);
    assert.equal(saved.depth, evaluationA.depth);
    assert.equal(saved.status, evaluationA.status);
    assert.ok(saved.sections.length > 0, "should have sections");
  });

  it("getEvaluation returns undefined for wrong intake", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });

    const notFound = await store.getEvaluation("WRONG-INTAKE", evaluationA.id);
    assert.equal(notFound, undefined);
  });

  it("getEvaluation returns undefined for wrong evaluation id", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });

    const notFound = await store.getEvaluation(evaluationA.intakeId, "WRONG-EVAL");
    assert.equal(notFound, undefined);
  });

  it("listEvaluationsForIntake returns all evaluations newest first", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });
    await store.saveEvaluation({ evaluation: evaluationB });

    const list = await store.listEvaluationsForIntake(evaluationA.intakeId);
    assert.equal(list.length, 2, "should have 2 evaluations");
    assert.ok(list[0].createdAt >= list[1].createdAt, "should be newest first");
  });

  it("listEvaluationsForIntake returns empty array for unknown intake", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });

    const list = await store.listEvaluationsForIntake("UNKNOWN-INTAKE");
    assert.deepEqual(list, []);
  });

  it("saving a second evaluation does not delete the first", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });
    await store.saveEvaluation({ evaluation: evaluationB });

    const first = await store.getEvaluation(evaluationA.intakeId, evaluationA.id);
    assert.ok(first, "first evaluation should still exist after second save");
  });

  it("getLatestEvaluationForIntake returns newest evaluation", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });
    await store.saveEvaluation({ evaluation: evaluationB });

    const latest = await store.getLatestEvaluationForIntake(evaluationA.intakeId);
    assert.ok(latest, "should return an evaluation");
    // evaluationB has a later timestamp (NOW_B > NOW_A)
    assert.equal(latest.createdAt, NOW_B);
  });

  it("getLatestEvaluationForIntake returns undefined for unknown intake", async () => {
    const store = new InMemoryProjectIntakeStore();
    const latest = await store.getLatestEvaluationForIntake("UNKNOWN-INTAKE");
    assert.equal(latest, undefined);
  });

  it("listAgentRuns returns derived agent runs for evaluation", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });

    const runs = await store.listAgentRuns(evaluationA.id);
    assert.equal(runs.length, evaluationA.sections.length, "one run per section");
    for (const run of runs) {
      assert.equal(run.evaluationId, evaluationA.id);
      assert.equal(run.status, "success");
      assert.ok(run.agentRole, "agentRole should be set");
      assert.ok(run.provider, "provider should be set");
    }
  });

  it("listAgentRuns returns empty array for unknown evaluation", async () => {
    const store = new InMemoryProjectIntakeStore();
    const runs = await store.listAgentRuns("UNKNOWN-EVAL");
    assert.deepEqual(runs, []);
  });

  it("saveEvaluation accepts explicit agentRuns override", async () => {
    const store = new InMemoryProjectIntakeStore();
    const derivedRuns = agentRunsFromEvaluation(evaluationA);
    const customRun = { ...derivedRuns[0], finishReason: "stop" };

    await store.saveEvaluation({ evaluation: evaluationA, agentRuns: [customRun] });

    const runs = await store.listAgentRuns(evaluationA.id);
    assert.equal(runs.length, 1, "should have exactly 1 explicit run");
    assert.equal(runs[0].finishReason, "stop");
  });

  it("saved evaluation maps to valid legacy draft", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation({ evaluation: evaluationA });

    const saved = await store.getEvaluation(evaluationA.intakeId, evaluationA.id);
    const draft = evaluationToLegacyDraft(saved, {
      idFactory: testIdFactory,
      now: saved.createdAt,
    });
    const result = validateIntakeAnalysisDraft(draft);
    assert.ok(result.valid, `draft should be valid, got: ${result.errors?.join(", ")}`);
  });
});

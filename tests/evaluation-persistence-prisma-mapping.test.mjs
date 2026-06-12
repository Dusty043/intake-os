import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  agentRunsFromEvaluation,
  fromEvaluationRow,
  fromSectionRow,
  fromAgentRunRow,
} from "../dist/src/application/evaluation-persistence.js";
import { EvaluationOrchestrator } from "../dist/src/application/evaluation-orchestrator.js";
import { createAllMockEvaluationAgents } from "../dist/src/application/agents/mock/index.js";
import { validateIntakeEvaluation } from "../dist/src/application/intake-evaluation.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const NOW = "2026-06-12T10:00:00.000Z";
const ACTOR = { id: "USER-001", role: "admin", displayName: "Test Admin" };

let _counter = 0;
const testIdFactory = (prefix) => `${prefix}-${String(++_counter).padStart(4, "0")}`;

function makeIntake(overrides = {}) {
  return {
    id: "INTAKE-001",
    title: "Build a KPI dashboard",
    description:
      "Our business goal is to build an internal dashboard showing real-time sales KPIs with role-based access and Salesforce integration.",
    requester: "alice@example.com",
    department: "Sales",
    projectType: "internal_dashboard",
    status: "submitted",
    createdAt: NOW,
    createdBy: ACTOR,
    source: { system: "manual" },
    externalLinks: [],
    ...overrides,
  };
}

// Fake Date-like objects for testing mapper without DB
function fakeDate(iso) {
  return { toISOString: () => iso };
}

function fakeDecimal(value) {
  return { toNumber: () => value };
}

// ─── Shared evaluation ────────────────────────────────────────────────────────

let evaluation;

before(async () => {
  const orch = new EvaluationOrchestrator({
    agents: createAllMockEvaluationAgents(),
    idFactory: testIdFactory,
    now: () => NOW,
  });
  const result = await orch.orchestrate(makeIntake(), {
    actor: ACTOR,
    depth: "full",
    provider: "mock",
    allowDepthUpgrade: false,
  });
  assert.equal(result.kind, "evaluation_ready", "setup: expected evaluation_ready");
  evaluation = result.evaluation;
});

// ─── agentRunsFromEvaluation ──────────────────────────────────────────────────

describe("agentRunsFromEvaluation", () => {
  it("derives one agent run per section", () => {
    const runs = agentRunsFromEvaluation(evaluation);
    assert.equal(runs.length, evaluation.sections.length, "one run per section");
  });

  it("each run has id prefixed RUN-{sectionId}", () => {
    const runs = agentRunsFromEvaluation(evaluation);
    for (let i = 0; i < runs.length; i++) {
      const section = evaluation.sections[i];
      assert.equal(runs[i].id, `RUN-${section.id}`);
      assert.equal(runs[i].sectionId, section.id);
    }
  });

  it("run agentRole matches section kind", () => {
    const runs = agentRunsFromEvaluation(evaluation);
    for (let i = 0; i < runs.length; i++) {
      assert.equal(runs[i].agentRole, evaluation.sections[i].kind);
    }
  });

  it("derived runs have status=success", () => {
    const runs = agentRunsFromEvaluation(evaluation);
    for (const run of runs) {
      assert.equal(run.status, "success");
    }
  });

  it("preserves provider/model/tokens/latency/cost from provenance", () => {
    const runs = agentRunsFromEvaluation(evaluation);
    for (let i = 0; i < runs.length; i++) {
      const p = evaluation.sections[i].provenance;
      assert.equal(runs[i].provider, p.provider);
      assert.equal(runs[i].model, p.model);
      assert.equal(runs[i].inputTokens, p.inputTokens);
      assert.equal(runs[i].outputTokens, p.outputTokens);
      assert.equal(runs[i].totalTokens, p.totalTokens);
      assert.equal(runs[i].latencyMs, p.latencyMs);
      assert.equal(runs[i].estimatedCostUsd, p.estimatedCostUsd);
      assert.equal(runs[i].createdAt, p.generatedAt);
      assert.equal(runs[i].completedAt, p.generatedAt);
    }
  });
});

// ─── fromSectionRow ───────────────────────────────────────────────────────────

describe("fromSectionRow", () => {
  it("maps all section kinds from a persistence row", () => {
    for (const section of evaluation.sections) {
      const row = {
        id: section.id,
        evaluationId: section.evaluationId,
        sectionKind: section.kind,
        content: section.content,
        provenance: section.provenance,
        version: section.version,
        supersededById: null,
        createdAt: fakeDate(section.provenance.generatedAt),
      };
      const mapped = fromSectionRow(row);
      assert.equal(mapped.id, section.id);
      assert.equal(mapped.kind, section.kind);
      assert.equal(mapped.evaluationId, section.evaluationId);
      assert.equal(mapped.version, section.version);
      assert.equal(mapped.supersededById, undefined);
    }
  });

  it("uses fallback provenance when provenance is null", () => {
    const section = evaluation.sections[0];
    const row = {
      id: section.id,
      evaluationId: section.evaluationId,
      sectionKind: section.kind,
      content: section.content,
      provenance: null,
      version: section.version,
      supersededById: null,
      createdAt: fakeDate(NOW),
    };
    const mapped = fromSectionRow(row);
    assert.equal(mapped.provenance.provider, "mock");
    assert.equal(mapped.provenance.agentRole, section.kind);
    assert.equal(mapped.provenance.generatedAt, NOW);
  });

  it("preserves section provenance fields", () => {
    const section = evaluation.sections[0];
    const row = {
      id: section.id,
      evaluationId: section.evaluationId,
      sectionKind: section.kind,
      content: section.content,
      provenance: {
        provider: "mock",
        model: "mock-v1",
        agentRole: section.kind,
        generatedAt: NOW,
        confidence: 0.85,
        latencyMs: 42,
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        estimatedCostUsd: null,
      },
      version: section.version,
      supersededById: null,
      createdAt: fakeDate(NOW),
    };
    const mapped = fromSectionRow(row);
    assert.equal(mapped.provenance.confidence, 0.85);
    assert.equal(mapped.provenance.latencyMs, 42);
    assert.equal(mapped.provenance.inputTokens, 100);
    assert.equal(mapped.provenance.outputTokens, 200);
    assert.equal(mapped.provenance.totalTokens, 300);
  });
});

// ─── fromAgentRunRow ──────────────────────────────────────────────────────────

describe("fromAgentRunRow", () => {
  it("maps an agent run row with full fields", () => {
    const section = evaluation.sections[0];
    const row = {
      id: `RUN-${section.id}`,
      evaluationId: evaluation.id,
      sectionId: section.id,
      agentRole: section.kind,
      provider: "mock",
      model: "mock-v1",
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      latencyMs: 50,
      estimatedCostUsd: fakeDecimal(0.001),
      finishReason: "stop",
      status: "success",
      errorMessage: null,
      startedAt: fakeDate(NOW),
      completedAt: fakeDate(NOW),
      createdAt: fakeDate(NOW),
    };
    const run = fromAgentRunRow(row);
    assert.equal(run.id, row.id);
    assert.equal(run.evaluationId, evaluation.id);
    assert.equal(run.sectionId, section.id);
    assert.equal(run.agentRole, section.kind);
    assert.equal(run.provider, "mock");
    assert.equal(run.model, "mock-v1");
    assert.equal(run.inputTokens, 100);
    assert.equal(run.outputTokens, 200);
    assert.equal(run.totalTokens, 300);
    assert.equal(run.latencyMs, 50);
    assert.ok(Math.abs(run.estimatedCostUsd - 0.001) < 0.0001, "estimatedCostUsd should be ~0.001");
    assert.equal(run.finishReason, "stop");
    assert.equal(run.status, "success");
    assert.equal(run.errorMessage, undefined);
    assert.equal(run.startedAt, NOW);
    assert.equal(run.completedAt, NOW);
    assert.equal(run.createdAt, NOW);
  });

  it("maps null estimatedCostUsd to null", () => {
    const section = evaluation.sections[0];
    const row = {
      id: `RUN-${section.id}`,
      evaluationId: evaluation.id,
      sectionId: section.id,
      agentRole: section.kind,
      provider: "mock",
      model: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      latencyMs: null,
      estimatedCostUsd: null,
      finishReason: null,
      status: "success",
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: fakeDate(NOW),
    };
    const run = fromAgentRunRow(row);
    assert.equal(run.estimatedCostUsd, null, "null Decimal should map to null");
    assert.equal(run.model, undefined);
    assert.equal(run.startedAt, undefined);
    assert.equal(run.completedAt, undefined);
    assert.equal(run.sectionId, section.id);
  });

  it("Decimal cost maps safely to number", () => {
    const section = evaluation.sections[0];
    const row = {
      id: `RUN-${section.id}`,
      evaluationId: evaluation.id,
      sectionId: null,
      agentRole: section.kind,
      provider: "openai",
      model: "gpt-4o",
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      latencyMs: null,
      estimatedCostUsd: fakeDecimal(1.2345),
      finishReason: null,
      status: "success",
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: fakeDate(NOW),
    };
    const run = fromAgentRunRow(row);
    assert.equal(typeof run.estimatedCostUsd, "number");
    assert.ok(Math.abs(run.estimatedCostUsd - 1.2345) < 0.0001);
  });
});

// ─── fromEvaluationRow ────────────────────────────────────────────────────────

describe("fromEvaluationRow", () => {
  it("maps a full evaluation row with sections", () => {
    const row = {
      id: evaluation.id,
      intakeId: evaluation.intakeId,
      depth: evaluation.depth,
      status: evaluation.status,
      qualityScore: evaluation.qualityScore ?? null,
      evaluationVersion: evaluation.evaluationVersion,
      createdAt: fakeDate(evaluation.createdAt),
      createdById: evaluation.createdBy.id,
      createdByName: evaluation.createdBy.displayName ?? null,
      createdByEmail: null,
      createdByRole: evaluation.createdBy.role,
      sections: evaluation.sections.map((s) => ({
        id: s.id,
        evaluationId: s.evaluationId,
        sectionKind: s.kind,
        content: s.content,
        provenance: s.provenance,
        version: s.version,
        supersededById: null,
        createdAt: fakeDate(s.provenance.generatedAt),
      })),
    };
    const mapped = fromEvaluationRow(row);
    assert.equal(mapped.id, evaluation.id);
    assert.equal(mapped.intakeId, evaluation.intakeId);
    assert.equal(mapped.depth, evaluation.depth);
    assert.equal(mapped.status, evaluation.status);
    assert.equal(mapped.evaluationVersion, evaluation.evaluationVersion);
    assert.equal(mapped.sections.length, evaluation.sections.length);
  });

  it("validates evaluation after mapping — valid evaluation passes", () => {
    const row = {
      id: evaluation.id,
      intakeId: evaluation.intakeId,
      depth: evaluation.depth,
      status: evaluation.status,
      qualityScore: evaluation.qualityScore ?? null,
      evaluationVersion: evaluation.evaluationVersion,
      createdAt: fakeDate(evaluation.createdAt),
      createdById: evaluation.createdBy.id,
      createdByName: evaluation.createdBy.displayName ?? null,
      createdByEmail: null,
      createdByRole: evaluation.createdBy.role,
      sections: evaluation.sections.map((s) => ({
        id: s.id,
        evaluationId: s.evaluationId,
        sectionKind: s.kind,
        content: s.content,
        provenance: s.provenance,
        version: s.version,
        supersededById: null,
        createdAt: fakeDate(s.provenance.generatedAt),
      })),
    };
    assert.doesNotThrow(() => validateIntakeEvaluation(fromEvaluationRow(row)));
  });

  it("preserves qualityScore from JSON column", () => {
    const row = {
      id: evaluation.id,
      intakeId: evaluation.intakeId,
      depth: evaluation.depth,
      status: evaluation.status,
      qualityScore: evaluation.qualityScore,
      evaluationVersion: evaluation.evaluationVersion,
      createdAt: fakeDate(evaluation.createdAt),
      createdById: evaluation.createdBy.id,
      createdByName: null,
      createdByEmail: null,
      createdByRole: evaluation.createdBy.role,
      sections: evaluation.sections.map((s) => ({
        id: s.id,
        evaluationId: s.evaluationId,
        sectionKind: s.kind,
        content: s.content,
        provenance: s.provenance,
        version: s.version,
        supersededById: null,
        createdAt: fakeDate(s.provenance.generatedAt),
      })),
    };
    const mapped = fromEvaluationRow(row);
    if (evaluation.qualityScore) {
      assert.ok(mapped.qualityScore, "qualityScore should be preserved");
      assert.equal(mapped.qualityScore.overall, evaluation.qualityScore.overall);
      assert.equal(mapped.qualityScore.readinessBand, evaluation.qualityScore.readinessBand);
    }
  });

  it("preserves all section kinds present in full evaluation", () => {
    const row = {
      id: evaluation.id,
      intakeId: evaluation.intakeId,
      depth: evaluation.depth,
      status: evaluation.status,
      qualityScore: evaluation.qualityScore ?? null,
      evaluationVersion: evaluation.evaluationVersion,
      createdAt: fakeDate(evaluation.createdAt),
      createdById: evaluation.createdBy.id,
      createdByName: null,
      createdByEmail: null,
      createdByRole: evaluation.createdBy.role,
      sections: evaluation.sections.map((s) => ({
        id: s.id,
        evaluationId: s.evaluationId,
        sectionKind: s.kind,
        content: s.content,
        provenance: s.provenance,
        version: s.version,
        supersededById: null,
        createdAt: fakeDate(s.provenance.generatedAt),
      })),
    };
    const mapped = fromEvaluationRow(row);
    const kinds = mapped.sections.map((s) => s.kind);
    const originalKinds = evaluation.sections.map((s) => s.kind);
    assert.deepEqual(kinds, originalKinds, "section kinds should match in order");
  });
});

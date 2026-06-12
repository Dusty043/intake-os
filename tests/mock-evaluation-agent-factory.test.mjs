import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createAllMockEvaluationAgents,
  createMockEvaluationAgentsForDepth,
  runMockEvaluationAgentsSequentiallyForTest,
} from "../dist/src/application/agents/mock/index.js";
import { EVALUATION_DEPTH_ROUTING_TABLE, evaluationSectionKinds } from "../dist/src/application/intake-evaluation.js";
import { evaluationToLegacyDraft } from "../dist/src/application/evaluation-draft-mapper.js";
import { validateIntakeAnalysisDraft } from "../dist/src/application/intake-analysis.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const NOW = "2026-06-12T00:00:00.000Z";
const ACTOR = { id: "USER-001", email: "test@example.com", name: "Test User", role: "admin" };

let _counter = 0;
const testIdFactory = (prefix) => `${prefix}-${String(++_counter).padStart(3, "0")}`;
const baseOpts = { actor: ACTOR, provider: "mock", idFactory: testIdFactory, now: NOW };

function makeIntake(overrides = {}) {
  return {
    id: "INTAKE-001",
    title: "Build a KPI dashboard for the sales team",
    description: "We need an internal dashboard showing real-time sales KPIs. Should integrate with Salesforce and display charts for revenue, pipeline, and forecast. The dashboard must be accessible to the sales team with role-based access.",
    requester: "alice@example.com",
    department: "Sales",
    projectType: "internal_dashboard",
    status: "submitted",
    createdAt: NOW,
    createdBy: ACTOR,
    source: { channel: "manual" },
    externalLinks: [],
    ...overrides,
  };
}

// ─── createAllMockEvaluationAgents ────────────────────────────────────────────

describe("createAllMockEvaluationAgents", () => {
  it("returns exactly 12 agents", () => {
    const agents = createAllMockEvaluationAgents();
    assert.equal(agents.length, 12);
  });

  it("all agent roles are unique", () => {
    const agents = createAllMockEvaluationAgents();
    const roles = agents.map((a) => a.role);
    const uniqueRoles = new Set(roles);
    assert.equal(uniqueRoles.size, 12);
  });

  it("all agent roles are valid EvaluationSectionKinds", () => {
    const agents = createAllMockEvaluationAgents();
    for (const agent of agents) {
      assert.ok(evaluationSectionKinds.includes(agent.role), `${agent.role} is not a valid section kind`);
    }
  });

  it("covers all 12 section kinds", () => {
    const agents = createAllMockEvaluationAgents();
    const roles = new Set(agents.map((a) => a.role));
    for (const kind of evaluationSectionKinds) {
      assert.ok(roles.has(kind), `missing agent for kind: ${kind}`);
    }
  });
});

// ─── createMockEvaluationAgentsForDepth ──────────────────────────────────────

describe("createMockEvaluationAgentsForDepth", () => {
  it("light depth returns 5 agents", () => {
    const agents = createMockEvaluationAgentsForDepth("light");
    assert.equal(agents.length, EVALUATION_DEPTH_ROUTING_TABLE.light.length);
    assert.equal(agents.length, 5);
  });

  it("standard depth returns 10 agents", () => {
    const agents = createMockEvaluationAgentsForDepth("standard");
    assert.equal(agents.length, EVALUATION_DEPTH_ROUTING_TABLE.standard.length);
    assert.equal(agents.length, 10);
  });

  it("full depth returns 12 agents", () => {
    const agents = createMockEvaluationAgentsForDepth("full");
    assert.equal(agents.length, EVALUATION_DEPTH_ROUTING_TABLE.full.length);
    assert.equal(agents.length, 12);
  });

  it("light depth agents match routing table kinds", () => {
    const agents = createMockEvaluationAgentsForDepth("light");
    const roles = agents.map((a) => a.role);
    assert.deepEqual(roles, EVALUATION_DEPTH_ROUTING_TABLE.light);
  });

  it("standard depth agents match routing table kinds", () => {
    const agents = createMockEvaluationAgentsForDepth("standard");
    const roles = agents.map((a) => a.role);
    assert.deepEqual(roles, EVALUATION_DEPTH_ROUTING_TABLE.standard);
  });

  it("full depth agents match routing table kinds", () => {
    const agents = createMockEvaluationAgentsForDepth("full");
    const roles = agents.map((a) => a.role);
    assert.deepEqual(roles, EVALUATION_DEPTH_ROUTING_TABLE.full);
  });

  it("light depth always includes intake_brief and quality_review", () => {
    const agents = createMockEvaluationAgentsForDepth("light");
    const roles = agents.map((a) => a.role);
    assert.ok(roles.includes("intake_brief"));
    assert.ok(roles.includes("quality_review"));
  });

  it("light depth does NOT include architecture or custom_build", () => {
    const agents = createMockEvaluationAgentsForDepth("light");
    const roles = agents.map((a) => a.role);
    assert.ok(!roles.includes("architecture"));
    assert.ok(!roles.includes("custom_build"));
  });
});

// ─── runMockEvaluationAgentsSequentiallyForTest ───────────────────────────────

describe("runMockEvaluationAgentsSequentiallyForTest", () => {
  it("returns sections for standard depth", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "standard", baseOpts);
    assert.equal(sections.length, EVALUATION_DEPTH_ROUTING_TABLE.standard.length);
  });

  it("section kinds match routing table for standard", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "standard", baseOpts);
    const kinds = sections.map((s) => s.kind);
    assert.deepEqual(kinds, EVALUATION_DEPTH_ROUTING_TABLE.standard);
  });

  it("returns sections for light depth", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "light", baseOpts);
    assert.equal(sections.length, 5);
  });

  it("returns sections for full depth", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "full", baseOpts);
    assert.equal(sections.length, 12);
  });

  it("each section has id, evaluationId, kind, content, version, provenance", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "standard", baseOpts);
    for (const s of sections) {
      assert.ok(s.id);
      assert.ok(s.evaluationId);
      assert.ok(s.kind);
      assert.ok(s.content !== undefined && s.content !== null);
      assert.ok(s.version >= 1);
      assert.ok(s.provenance);
    }
  });

  it("provenance has provider, agentRole, generatedAt", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "light", baseOpts);
    for (const s of sections) {
      assert.equal(s.provenance.provider, "mock");
      assert.equal(s.provenance.agentRole, s.kind);
      assert.equal(s.provenance.generatedAt, NOW);
    }
  });
});

// ─── Round-trip: mock pipeline → evaluationToLegacyDraft ─────────────────────

describe("mock pipeline output → valid legacy draft", () => {
  it("standard depth produces a valid IntakeAnalysisDraft via mapper", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "standard", baseOpts);

    const evaluation = {
      id: testIdFactory("EVAL"),
      intakeId: intake.id,
      depth: "standard",
      sections,
      status: "ready_for_review",
      evaluationVersion: 1,
      createdAt: NOW,
      createdBy: ACTOR,
    };

    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });

    assert.ok(draft.id);
    assert.equal(draft.intakeId, intake.id);
    assert.ok(draft.sourceSummary.length > 0);
    assert.ok(draft.subtasks.length > 0);
    assert.ok(draft.estimatedStoryPoints >= 1);
    assert.ok(draft.recommendedTechStack.length > 0);
  });

  it("draft from full depth passes validateIntakeAnalysisDraft", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "full", baseOpts);

    const evaluation = {
      id: testIdFactory("EVAL"),
      intakeId: intake.id,
      depth: "full",
      sections,
      status: "ready_for_review",
      evaluationVersion: 1,
      createdAt: NOW,
      createdBy: ACTOR,
    };

    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    const result = validateIntakeAnalysisDraft(draft);

    if (!result.valid) {
      console.error("Validation errors:", result.errors);
    }
    assert.equal(result.valid, true, `Expected valid draft but got errors: ${result.errors.join(", ")}`);
  });

  it("full depth produces quality_review section with valid score", async () => {
    const intake = makeIntake();
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "full", baseOpts);
    const qualitySection = sections.find((s) => s.kind === "quality_review");

    assert.ok(qualitySection, "quality_review section should exist");
    assert.ok(qualitySection.content.qualityScore.overall >= 0);
    assert.ok(qualitySection.content.qualityScore.overall <= 100);
    assert.ok(["ready", "usable", "needs_revision", "not_ready"].includes(
      qualitySection.content.qualityScore.readinessBand,
    ));
  });

  it("light depth produces valid draft with minimal sections", async () => {
    const intake = makeIntake({
      title: "Simple sales report",
      description: "A simple read-only report to track sales figures.",
    });
    const sections = await runMockEvaluationAgentsSequentiallyForTest(intake, "light", baseOpts);

    const evaluation = {
      id: testIdFactory("EVAL"),
      intakeId: intake.id,
      depth: "light",
      sections,
      status: "ready_for_review",
      evaluationVersion: 1,
      createdAt: NOW,
      createdBy: ACTOR,
    };

    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.ok(draft.id);
    assert.ok(draft.subtasks.length > 0);
  });
});

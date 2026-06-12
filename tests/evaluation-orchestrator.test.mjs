import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EvaluationOrchestrator,
  EvaluationOrchestrationError,
  AgentOutputValidationError,
  MissingEvaluationAgentError,
} from "../dist/src/application/evaluation-orchestrator.js";
import {
  createAllMockEvaluationAgents,
  createMockEvaluationAgentsForDepth,
} from "../dist/src/application/agents/mock/index.js";
import {
  EVALUATION_DEPTH_ROUTING_TABLE,
  qualityBandFromScore,
} from "../dist/src/application/intake-evaluation.js";
import { evaluationToLegacyDraft } from "../dist/src/application/evaluation-draft-mapper.js";
import { validateIntakeAnalysisDraft } from "../dist/src/application/intake-analysis.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const NOW = "2026-06-12T10:00:00.000Z";
const ACTOR = { id: "USER-001", role: "admin", displayName: "Test Admin" };

let _counter = 0;
const testIdFactory = (prefix) => `${prefix}-${String(++_counter).padStart(4, "0")}`;

function makeOrchestrator(agentOverrides = {}) {
  const base = createAllMockEvaluationAgents();
  const agents = base.map((a) => agentOverrides[a.role] ?? a);
  return new EvaluationOrchestrator({
    agents,
    idFactory: testIdFactory,
    now: () => NOW,
  });
}

function makeIntake(overrides = {}) {
  return {
    id: "INTAKE-001",
    title: "Build a KPI dashboard for the sales team",
    // description deliberately includes business/goal keywords to avoid clarification blocking
    description:
      "Our business goal is to build an internal dashboard showing real-time sales KPIs. Should integrate with Salesforce and display charts for revenue, pipeline, and forecast. The dashboard must be accessible to the sales team with role-based access control.",
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

function makeThinIntake() {
  return makeIntake({ title: "AB", description: "x", department: "Unknown" });
}

const baseOpts = (depth = "standard") => ({
  actor: ACTOR,
  depth,
  provider: "mock",
});

// Stub agent factories

function stubAgent(role, content, opts = {}) {
  return {
    role,
    run: async (_ctx, _opts) => ({
      sectionKind: role,
      content,
      confidence: opts.confidence ?? 80,
      warnings: opts.warnings ?? [],
      isClarificationBlocking: opts.isClarificationBlocking ?? false,
      ...(opts.usage ? { usage: opts.usage } : {}),
    }),
  };
}

function stubClassifier(recommendedDepth) {
  return stubAgent("classification", {
    projectType: "saas_platform",
    confidence: 90,
    reasoning: "stub",
    recommendedDepth,
    signals: [],
  });
}

function stubCritic(overallScore) {
  const band = qualityBandFromScore(overallScore);
  const score = overallScore;
  return stubAgent("quality_review", {
    qualityScore: {
      dimensions: {
        completeness: score,
        consistency: score,
        specificity: score,
        feasibility: score,
        riskCoverage: score,
        handoffReadiness: score,
      },
      overall: score,
      readinessBand: band,
    },
    strengths: [],
    weaknesses: [],
    requiredRevisions: [],
    reviewerWarnings: [],
  });
}

function stubBlockingClarification() {
  return {
    role: "clarification_questions",
    run: async (_ctx, _opts) => ({
      sectionKind: "clarification_questions",
      content: {
        isBlocking: true,
        questions: [
          {
            id: "q1",
            question: "What is the business goal?",
            reason: "No goal stated",
            required: true,
          },
        ],
        missingFields: ["businessGoal", "targetUsers"],
      },
      confidence: 30,
      warnings: ["Intake too thin to evaluate"],
      isClarificationBlocking: true,
    }),
  };
}

// ─── Construction ─────────────────────────────────────────────────────────────

describe("EvaluationOrchestrator — construction", () => {
  it("constructs with all 12 mock agents", () => {
    const orch = makeOrchestrator();
    assert.ok(orch instanceof EvaluationOrchestrator);
  });

  it("rejects duplicate agent roles", () => {
    const agents = createAllMockEvaluationAgents();
    // Add a duplicate intake_brief
    const duplicate = agents.find((a) => a.role === "intake_brief");
    assert.throws(
      () =>
        new EvaluationOrchestrator({
          agents: [...agents, duplicate],
          idFactory: testIdFactory,
          now: () => NOW,
        }),
      (err) => err.message.includes("Duplicate evaluation agent role") && err.message.includes("intake_brief"),
    );
  });

  it("rejects missing required Stage 1 agent (intake_brief)", () => {
    const agents = createAllMockEvaluationAgents().filter((a) => a.role !== "intake_brief");
    assert.throws(
      () =>
        new EvaluationOrchestrator({
          agents,
          idFactory: testIdFactory,
          now: () => NOW,
        }),
      (err) => err.name === "MissingEvaluationAgentError" || err.message.includes("intake_brief"),
    );
  });

  it("rejects missing required Stage 1 agent (clarification_questions)", () => {
    const agents = createAllMockEvaluationAgents().filter(
      (a) => a.role !== "clarification_questions",
    );
    assert.throws(
      () =>
        new EvaluationOrchestrator({
          agents,
          idFactory: testIdFactory,
          now: () => NOW,
        }),
      (err) =>
        err.name === "MissingEvaluationAgentError" ||
        err.message.includes("clarification_questions"),
    );
  });

  it("rejects missing synthesis agent", () => {
    const agents = createAllMockEvaluationAgents().filter((a) => a.role !== "synthesis");
    assert.throws(
      () =>
        new EvaluationOrchestrator({
          agents,
          idFactory: testIdFactory,
          now: () => NOW,
        }),
      (err) => err.message.includes("synthesis"),
    );
  });

  it("rejects missing quality_review agent", () => {
    const agents = createAllMockEvaluationAgents().filter((a) => a.role !== "quality_review");
    assert.throws(
      () =>
        new EvaluationOrchestrator({
          agents,
          idFactory: testIdFactory,
          now: () => NOW,
        }),
      (err) => err.message.includes("quality_review"),
    );
  });
});

// ─── Clarification blocking ────────────────────────────────────────────────────

describe("EvaluationOrchestrator — clarification blocking", () => {
  it("thin intake returns clarification_required", async () => {
    const orch = makeOrchestrator({ clarification_questions: stubBlockingClarification() });
    const result = await orch.orchestrate(makeThinIntake(), baseOpts("standard"));
    assert.equal(result.kind, "clarification_required");
  });

  it("clarification_required stops before classification", async () => {
    const orch = makeOrchestrator({ clarification_questions: stubBlockingClarification() });
    const result = await orch.orchestrate(makeThinIntake(), baseOpts("standard"));
    assert.equal(result.kind, "clarification_required");
    const { clarification } = result;
    // classification was never run — outcome does not have it
    assert.ok(!("classification" in clarification));
  });

  it("clarification_required stops before Stage 2 (no architecture section)", async () => {
    const orch = makeOrchestrator({ clarification_questions: stubBlockingClarification() });
    const result = await orch.orchestrate(makeThinIntake(), baseOpts("full"));
    assert.equal(result.kind, "clarification_required");
    const { clarification } = result;
    // ClarificationOutcome does not include architecture or any Stage 2 section
    assert.ok(!("architecture" in clarification));
    assert.ok(!("synthesis" in clarification));
    assert.ok(!("quality_review" in clarification));
  });

  it("clarification_required includes intakeBriefSection and clarificationSection", async () => {
    const orch = makeOrchestrator({ clarification_questions: stubBlockingClarification() });
    const result = await orch.orchestrate(makeThinIntake(), baseOpts("standard"));
    assert.equal(result.kind, "clarification_required");
    const { clarification } = result;
    assert.ok(clarification.intakeBriefSection, "intakeBriefSection should be present");
    assert.equal(clarification.intakeBriefSection.kind, "intake_brief");
    assert.ok(clarification.clarificationSection, "clarificationSection should be present");
    assert.equal(clarification.clarificationSection.kind, "clarification_questions");
  });

  it("clarification_required includes questions and missingFields", async () => {
    const orch = makeOrchestrator({ clarification_questions: stubBlockingClarification() });
    const result = await orch.orchestrate(makeThinIntake(), baseOpts("standard"));
    assert.equal(result.kind, "clarification_required");
    const { clarification } = result;
    assert.ok(Array.isArray(clarification.questions));
    assert.ok(clarification.questions.length > 0);
    assert.ok(Array.isArray(clarification.missingFields));
    assert.ok(clarification.missingFields.length > 0);
  });

  it("light depth has no clarification_questions and never blocks", async () => {
    // light depth routing table does not include clarification_questions
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeThinIntake(), baseOpts("light"));
    // Should return evaluation_ready even for thin intake (no clarification step)
    assert.equal(result.kind, "evaluation_ready");
  });

  it("clarification outcome intakeId matches intake id", async () => {
    const orch = makeOrchestrator({ clarification_questions: stubBlockingClarification() });
    const intake = makeIntake({ id: "INTAKE-BLOCKING-001" });
    const result = await orch.orchestrate(intake, baseOpts("standard"));
    assert.equal(result.kind, "clarification_required");
    assert.equal(result.clarification.intakeId, "INTAKE-BLOCKING-001");
  });

  it("non-blocking intake reaches evaluation_ready", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
  });
});

// ─── Depth routing ────────────────────────────────────────────────────────────

describe("EvaluationOrchestrator — depth routing", () => {
  it("light depth produces only expected section kinds", async () => {
    const orch = makeOrchestrator();
    // allowDepthUpgrade=false ensures we test the routing table exactly, not classifier-driven depth
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("light"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    const kinds = result.evaluation.sections.map((s) => s.kind);
    assert.deepEqual(kinds, EVALUATION_DEPTH_ROUTING_TABLE.light);
  });

  it("standard depth produces only expected section kinds", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    const kinds = result.evaluation.sections.map((s) => s.kind);
    assert.deepEqual(kinds, EVALUATION_DEPTH_ROUTING_TABLE.standard);
  });

  it("full depth produces all 12 section kinds", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("full"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    const kinds = result.evaluation.sections.map((s) => s.kind);
    assert.deepEqual(kinds, EVALUATION_DEPTH_ROUTING_TABLE.full);
    assert.equal(kinds.length, 12);
  });

  it("section order is deterministic — matches routing table order", async () => {
    const orch = makeOrchestrator();
    const opts = { ...baseOpts("full"), allowDepthUpgrade: false };
    const result1 = await orch.orchestrate(makeIntake(), opts);
    const result2 = await orch.orchestrate(makeIntake(), opts);
    assert.equal(result1.kind, "evaluation_ready");
    assert.equal(result2.kind, "evaluation_ready");
    const order1 = result1.evaluation.sections.map((s) => s.kind);
    const order2 = result2.evaluation.sections.map((s) => s.kind);
    assert.deepEqual(order1, order2);
    assert.deepEqual(order1, EVALUATION_DEPTH_ROUTING_TABLE.full);
  });

  it("classifier can upgrade standard depth to full", async () => {
    const orch = makeOrchestrator({ classification: stubClassifier("full") });
    const result = await orch.orchestrate(makeIntake(), {
      ...baseOpts("standard"),
      allowDepthUpgrade: true,
    });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.depth, "full");
    assert.equal(result.evaluation.sections.length, 12);
  });

  it("classifier cannot downgrade depth", async () => {
    const orch = makeOrchestrator({ classification: stubClassifier("light") });
    const result = await orch.orchestrate(makeIntake(), {
      ...baseOpts("standard"),
      allowDepthUpgrade: true,
    });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.depth, "standard");
  });

  it("allowDepthUpgrade=false prevents classifier upgrade", async () => {
    const orch = makeOrchestrator({ classification: stubClassifier("full") });
    const result = await orch.orchestrate(makeIntake(), {
      ...baseOpts("standard"),
      allowDepthUpgrade: false,
    });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.depth, "standard");
    const kinds = result.evaluation.sections.map((s) => s.kind);
    assert.deepEqual(kinds, EVALUATION_DEPTH_ROUTING_TABLE.standard);
  });

  it("evaluation depth reflects effective depth after upgrade", async () => {
    const orch = makeOrchestrator({ classification: stubClassifier("full") });
    const result = await orch.orchestrate(makeIntake(), baseOpts("light"));
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.depth, "full");
  });
});

// ─── Quality gating ───────────────────────────────────────────────────────────

describe("EvaluationOrchestrator — quality gating", () => {
  it("QA score below 50 maps to not_ready", async () => {
    const orch = makeOrchestrator({ quality_review: stubCritic(40) });
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.status, "not_ready");
    assert.equal(result.evaluation.qualityScore?.readinessBand, "not_ready");
  });

  it("QA score 50–69 maps to needs_revision", async () => {
    const orch = makeOrchestrator({ quality_review: stubCritic(60) });
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.status, "needs_revision");
    assert.equal(result.evaluation.qualityScore?.readinessBand, "needs_revision");
  });

  it("QA score 70–89 maps to readinessBand usable and status ready_for_review", async () => {
    const orch = makeOrchestrator({ quality_review: stubCritic(75) });
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.status, "ready_for_review");
    assert.equal(result.evaluation.qualityScore?.readinessBand, "usable");
  });

  it("QA score 90+ maps to readinessBand ready and status ready_for_review", async () => {
    const orch = makeOrchestrator({ quality_review: stubCritic(95) });
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.status, "ready_for_review");
    assert.equal(result.evaluation.qualityScore?.readinessBand, "ready");
  });

  it("qualityScore is attached to IntakeEvaluation", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.ok(result.evaluation.qualityScore, "qualityScore should be present");
    assert.equal(typeof result.evaluation.qualityScore.overall, "number");
    assert.ok(result.evaluation.qualityScore.dimensions);
  });
});

// ─── Provenance and metadata ──────────────────────────────────────────────────

describe("EvaluationOrchestrator — provenance", () => {
  it("every section has provenance with provider, agentRole, generatedAt", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    for (const section of result.evaluation.sections) {
      assert.ok(section.provenance, `${section.kind} should have provenance`);
      assert.equal(section.provenance.provider, "mock");
      assert.equal(section.provenance.agentRole, section.kind);
      assert.equal(section.provenance.generatedAt, NOW);
    }
  });

  it("per-agent latencyMs is recorded in provenance", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("light"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    for (const section of result.evaluation.sections) {
      assert.equal(typeof section.provenance.latencyMs, "number");
      assert.ok(section.provenance.latencyMs >= 0, `${section.kind} latencyMs should be >= 0`);
    }
  });

  it("model is attached to provenance when provided", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), {
      ...baseOpts("light"),
      allowDepthUpgrade: false,
      model: "gpt-4o",
    });
    assert.equal(result.kind, "evaluation_ready");
    for (const section of result.evaluation.sections) {
      assert.equal(section.provenance.model, "gpt-4o");
    }
  });

  it("provider anthropic is reflected in section provenance", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), {
      ...baseOpts("light"),
      allowDepthUpgrade: false,
      provider: "anthropic",
    });
    assert.equal(result.kind, "evaluation_ready");
    for (const section of result.evaluation.sections) {
      assert.equal(section.provenance.provider, "anthropic");
    }
  });

  it("all sections share the same evaluationId", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    const evaluationId = result.evaluation.id;
    for (const section of result.evaluation.sections) {
      assert.equal(section.evaluationId, evaluationId);
    }
  });

  it("all sections have version 1", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("light"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    for (const section of result.evaluation.sections) {
      assert.equal(section.version, 1);
    }
  });
});

// ─── Agent output validation ──────────────────────────────────────────────────

describe("EvaluationOrchestrator — validation", () => {
  it("rejects agent output with wrong sectionKind", async () => {
    const wrongKindAgent = {
      role: "intake_brief",
      run: async () => ({
        sectionKind: "architecture", // wrong!
        content: { title: "t", rawSummary: "r", normalizedSummary: "n", statedGoals: [], successCriteria: [], knownConstraints: [] },
        confidence: 80,
        warnings: [],
      }),
    };
    const orch = makeOrchestrator({ intake_brief: wrongKindAgent });
    await assert.rejects(
      () => orch.orchestrate(makeIntake(), baseOpts("standard")),
      (err) => err.name === "AgentOutputValidationError" || err.message.includes("sectionKind"),
    );
  });

  it("rejects agent confidence below 0", async () => {
    const badAgent = {
      role: "intake_brief",
      run: async () => ({
        sectionKind: "intake_brief",
        content: { title: "t", rawSummary: "r", normalizedSummary: "n", statedGoals: [], successCriteria: [], knownConstraints: [] },
        confidence: -1,
        warnings: [],
      }),
    };
    const orch = makeOrchestrator({ intake_brief: badAgent });
    await assert.rejects(
      () => orch.orchestrate(makeIntake(), baseOpts("standard")),
      (err) => err.message.includes("confidence"),
    );
  });

  it("rejects agent confidence above 100", async () => {
    const badAgent = {
      role: "intake_brief",
      run: async () => ({
        sectionKind: "intake_brief",
        content: { title: "t", rawSummary: "r", normalizedSummary: "n", statedGoals: [], successCriteria: [], knownConstraints: [] },
        confidence: 150,
        warnings: [],
      }),
    };
    const orch = makeOrchestrator({ intake_brief: badAgent });
    await assert.rejects(
      () => orch.orchestrate(makeIntake(), baseOpts("standard")),
      (err) => err.message.includes("confidence"),
    );
  });

  it("rejects agent output with null content", async () => {
    const badAgent = {
      role: "intake_brief",
      run: async () => ({
        sectionKind: "intake_brief",
        content: null,
        confidence: 80,
        warnings: [],
      }),
    };
    const orch = makeOrchestrator({ intake_brief: badAgent });
    await assert.rejects(
      () => orch.orchestrate(makeIntake(), baseOpts("standard")),
      (err) => err.message.includes("content"),
    );
  });

  it("dryRunOnly is always true in distribution_plan section", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("full"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    const distSection = result.evaluation.sections.find((s) => s.kind === "distribution_plan");
    assert.ok(distSection, "distribution_plan section should exist");
    assert.equal(distSection.content.dryRunOnly, true);
  });

  it("final IntakeEvaluation passes validateIntakeEvaluation", async () => {
    // validateIntakeEvaluation is called inside orchestrate; if it throws, the test fails
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("full"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    // no exception = validation passed
    assert.ok(result.evaluation.id);
    assert.ok(result.evaluation.sections.length > 0);
  });
});

// ─── Integration: evaluation → legacy draft ───────────────────────────────────

describe("EvaluationOrchestrator — integration", () => {
  it("evaluation maps to valid legacy IntakeAnalysisDraft", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("full"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");

    const draft = evaluationToLegacyDraft(result.evaluation, {
      idFactory: testIdFactory,
      now: NOW,
    });
    const validation = validateIntakeAnalysisDraft(draft);
    if (!validation.valid) {
      console.error("Legacy draft validation errors:", validation.errors);
    }
    assert.equal(validation.valid, true, `Expected valid draft but got: ${validation.errors?.join(", ")}`);
  });

  it("evaluation contains createdBy actor", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.createdBy.id, ACTOR.id);
    assert.equal(result.evaluation.createdBy.role, ACTOR.role);
  });

  it("evaluation intakeId matches intake id", async () => {
    const orch = makeOrchestrator();
    const intake = makeIntake({ id: "INTAKE-XYZ" });
    const result = await orch.orchestrate(intake, { ...baseOpts("standard"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.intakeId, "INTAKE-XYZ");
  });

  it("evaluation evaluationVersion is 1", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("full"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    assert.equal(result.evaluation.evaluationVersion, 1);
  });

  it("synthesis runs after Stage 2 (has sections context)", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("full"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    const synthSection = result.evaluation.sections.find((s) => s.kind === "synthesis");
    assert.ok(synthSection, "synthesis section should exist");
    assert.ok(synthSection.content.executiveSummary, "synthesis should have executiveSummary");
  });

  it("quality_review runs after synthesis (can reference synthesis)", async () => {
    const orch = makeOrchestrator();
    const result = await orch.orchestrate(makeIntake(), { ...baseOpts("full"), allowDepthUpgrade: false });
    assert.equal(result.kind, "evaluation_ready");
    const qrSection = result.evaluation.sections.find((s) => s.kind === "quality_review");
    assert.ok(qrSection, "quality_review section should exist");
    assert.ok(qrSection.content.qualityScore, "quality_review should have qualityScore");
    // synthesis is before quality_review in the sections array
    const sectionKinds = result.evaluation.sections.map((s) => s.kind);
    const synthIdx = sectionKinds.indexOf("synthesis");
    const qrIdx = sectionKinds.indexOf("quality_review");
    assert.ok(synthIdx < qrIdx, "synthesis must precede quality_review");
  });
});

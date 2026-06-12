import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluationToLegacyDraft, legacyDraftToEvaluation } from "../dist/src/application/evaluation-draft-mapper.js";
import { getSection } from "../dist/src/application/intake-evaluation.js";
import { intakeAnalysisDraftSchemaVersion } from "../dist/src/application/intake-analysis.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const NOW = "2026-06-12T00:00:00.000Z";
const ACTOR = { id: "USER-001", email: "test@example.com", name: "Test User", role: "admin" };

let _counter = 0;
function testIdFactory(prefix) {
  return `${prefix}-${String(++_counter).padStart(3, "0")}`;
}

function resetCounter() { _counter = 0; }

function makeProvenance(kind) {
  return { provider: "mock", model: "mock-v1", agentRole: kind, generatedAt: NOW, confidence: 0.8 };
}

function makeSection(kind, content) {
  resetCounter();
  return {
    id: testIdFactory("SEC"),
    evaluationId: "EVAL-001",
    kind,
    content,
    version: 1,
    provenance: makeProvenance(kind),
  };
}

function makeIntakeBrief() {
  return makeSection("intake_brief", {
    title: "My Project",
    rawSummary: "We need a dashboard for tracking KPIs.",
    normalizedSummary: "Build a KPI dashboard.",
    statedGoals: ["Track sales KPIs", "Export to PDF"],
    successCriteria: ["Dashboard loads in < 2s"],
    knownConstraints: ["Must use React"],
  });
}

function makeWorkBreakdown() {
  return makeSection("work_breakdown", {
    subtasks: [
      {
        title: "Design wireframes",
        description: "Create wireframes for dashboard",
        acceptanceCriteria: ["Approved by PM"],
        estimatedHours: 8,
      },
      {
        title: "Implement API",
        description: "REST endpoints for KPI data",
        acceptanceCriteria: ["All tests pass", "Documented"],
        estimatedHours: 16,
      },
    ],
    milestones: ["Design complete", "MVP launch"],
    dependencies: [],
  });
}

function makeArchitecture() {
  return makeSection("architecture", {
    recommendation: "Use Next.js + Prisma + PostgreSQL",
    architectureStyle: "monolith",
    recommendedTechStack: ["Next.js", "Prisma", "PostgreSQL", "Tailwind"],
    integrationPoints: ["Salesforce API", "Slack webhooks"],
    dataStores: ["PostgreSQL"],
    deploymentNotes: ["Deploy on Vercel"],
    assumptions: ["Team is familiar with React"],
  });
}

function makeRiskSecurity() {
  return makeSection("risk_security", {
    risks: [
      {
        title: "Data exposure risk",
        severity: "high",
        category: "security",
        mitigation: "Encrypt at rest",
      },
    ],
    dataSensitivity: "confidential",
    securityReviewRequired: true,
  });
}

function makeCostEffort() {
  return makeSection("cost_effort", {
    estimatedStoryPoints: 21,
    estimatedEngineeringDays: 10,
    complexity: "medium",
    costDrivers: ["API integration", "Auth"],
    costAssumptions: ["Senior developer rate"],
    infraCostSignal: "low",
  });
}

function makeSynthesis() {
  return makeSection("synthesis", {
    executiveSummary: "Build a Next.js KPI dashboard with PostgreSQL backend.",
    recommendedPath: "Custom build with Next.js.",
    keyDecisions: ["Use PostgreSQL over MySQL", "No low-code option"],
    reviewNotes: ["Confirm with PM before starting"],
    approvalReadinessSummary: "Ready for approval.",
  });
}

function makeQualityReview() {
  return makeSection("quality_review", {
    qualityScore: {
      dimensions: {
        completeness: 85,
        consistency: 82,
        specificity: 80,
        feasibility: 88,
        riskCoverage: 78,
        handoffReadiness: 83,
      },
      overall: 83,
      readinessBand: "usable",
    },
    strengths: ["Clear tech stack"],
    weaknesses: ["Missing deadline"],
    requiredRevisions: [],
    reviewerWarnings: ["Confirm timeline with stakeholders"],
  });
}

function makeDistributionPlan() {
  return makeSection("distribution_plan", {
    monday: { required: true, suggestedBoard: "Dev Board", itemName: "KPI Dashboard", notes: [] },
    github: {
      required: true,
      repositoryName: "kpi-dashboard",
      issueLabels: ["enhancement"],
      issueBreakdownSuggested: true,
    },
    dryRunOnly: true,
    distributionNotes: ["Distribute after approval", "Not live yet"],
  });
}

function makeClassification() {
  return makeSection("classification", {
    projectType: "internal_tool",
    confidence: 0.9,
    reasoning: "Internal dashboard for company use",
    recommendedDepth: "standard",
    signals: ["internal", "dashboard"],
  });
}

function makeFullEvaluation(sectionOverrides = []) {
  resetCounter();
  const sections = [
    makeIntakeBrief(),
    makeWorkBreakdown(),
    makeArchitecture(),
    makeRiskSecurity(),
    makeCostEffort(),
    makeSynthesis(),
    makeQualityReview(),
    makeDistributionPlan(),
    makeClassification(),
    ...sectionOverrides,
  ];
  return {
    id: "EVAL-001",
    intakeId: "INTAKE-001",
    depth: "full",
    sections,
    qualityScore: makeQualityReview().content.qualityScore,
    status: "ready_for_review",
    evaluationVersion: 1,
    createdAt: NOW,
    createdBy: ACTOR,
  };
}

function makeMinimalDraft(overrides = {}) {
  return {
    id: "AIDRAFT-001",
    intakeId: "INTAKE-001",
    schemaVersion: intakeAnalysisDraftSchemaVersion,
    provider: "mock",
    model: "mock-v1",
    generatedAt: NOW,
    generatedBy: ACTOR,
    reviewStatus: "draft",
    sourceSummary: "Build a KPI dashboard.",
    projectType: "internal_tool",
    complexity: "medium",
    estimatedStoryPoints: 21,
    confidence: 0.83,
    recommendedTechStack: ["React"],
    requiredEvaluationSections: ["intake_brief", "synthesis"],
    infrastructureRequirements: [
      { kind: "monday_board", required: true, description: "Monday tracking", rationale: "Distribution requires it" },
    ],
    brief: {
      problemStatement: "Need a KPI dashboard.",
      proposedSolution: "Build with React and PostgreSQL.",
      scope: ["Track KPIs"],
      deliverables: ["MVP launch"],
      outOfScope: ["Not a live deployment tool"],
      assumptions: ["React team available"],
      complianceNotes: ["No compliance blockers detected."],
    },
    subtasks: [
      {
        id: "TASK-001",
        title: "Design",
        description: "Design phase",
        storyPoints: 3,
        acceptanceCriteria: ["PM approved"],
      },
    ],
    assignmentRecommendation: {
      confidence: 0.5,
      reason: "Roster not connected",
      matchedSkills: ["React"],
      workloadSignals: [],
      risks: [],
    },
    missingInformation: [],
    warnings: [],
    ...overrides,
  };
}

// ─── evaluationToLegacyDraft ──────────────────────────────────────────────────

describe("evaluationToLegacyDraft", () => {
  it("produces a draft with required top-level fields", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });

    assert.ok(draft.id);
    assert.equal(draft.intakeId, "INTAKE-001");
    assert.equal(draft.schemaVersion, intakeAnalysisDraftSchemaVersion);
    assert.equal(draft.reviewStatus, "draft");
    assert.equal(draft.generatedAt, NOW);
  });

  it("uses synthesis executiveSummary as sourceSummary when available", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });

    assert.ok(draft.sourceSummary.includes("Next.js KPI dashboard"));
  });

  it("falls back to intake_brief normalizedSummary when no synthesis", () => {
    const evaluation = makeFullEvaluation();
    evaluation.sections = evaluation.sections.filter((s) => s.kind !== "synthesis");
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });

    assert.ok(draft.sourceSummary.length > 0);
  });

  it("maps work_breakdown subtasks to draft subtasks with story points", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });

    assert.equal(draft.subtasks.length, 2);
    assert.equal(draft.subtasks[0].title, "Design wireframes");
    assert.equal(draft.subtasks[0].storyPoints, 2); // 8h / 4 = 2
    assert.equal(draft.subtasks[1].storyPoints, 4); // 16h / 4 = 4
  });

  it("uses cost_effort estimatedStoryPoints when available", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.equal(draft.estimatedStoryPoints, 21);
  });

  it("maps confidence from qualityScore.overall / 100", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.ok(Math.abs(draft.confidence - 0.83) < 0.01);
  });

  it("marks securityReviewRequired in complianceNotes", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    const hasSecurityNote = draft.brief.complianceNotes.some((n) => n.toLowerCase().includes("security review"));
    assert.ok(hasSecurityNote);
  });

  it("includes github_repository in infra when distribution plan requires it", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    const hasGithub = draft.infrastructureRequirements.some((r) => r.kind === "github_repository");
    assert.ok(hasGithub);
  });

  it("always includes monday_board in infra requirements", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    const hasMonday = draft.infrastructureRequirements.some((r) => r.kind === "monday_board");
    assert.ok(hasMonday);
  });

  it("uses classification projectType when available", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.equal(draft.projectType, "internal_tool");
  });

  it("produces a draft with sourceSummary truncated to 240 chars", () => {
    const longSummary = "A".repeat(300);
    const evaluation = makeFullEvaluation();
    evaluation.sections = evaluation.sections.map((s) => {
      if (s.kind === "synthesis") {
        return { ...s, content: { ...s.content, executiveSummary: longSummary } };
      }
      return s;
    });
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.ok(draft.sourceSummary.length <= 240);
  });

  it("includes reviewerWarnings from quality_review in warnings", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.ok(draft.warnings.includes("Confirm timeline with stakeholders"));
  });

  it("adds blocking clarification warning when clarification is blocking", () => {
    const clarification = makeSection("clarification_questions", {
      isBlocking: true,
      questions: [{ id: "Q1", question: "What is the timeline?", reason: "Needed", required: true }],
      missingFields: ["timeline"],
    });
    const evaluation = makeFullEvaluation([clarification]);
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    const hasBlockingWarning = draft.warnings.some((w) => w.toLowerCase().includes("clarification"));
    assert.ok(hasBlockingWarning);
  });

  it("produces default subtask when no work_breakdown section", () => {
    const evaluation = makeFullEvaluation();
    evaluation.sections = evaluation.sections.filter((s) => s.kind !== "work_breakdown");
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.equal(draft.subtasks.length, 1);
    assert.ok(draft.subtasks[0].title.includes("Review"));
  });

  it("requiredEvaluationSections reflects depth routing for 'full'", () => {
    const evaluation = makeFullEvaluation();
    const draft = evaluationToLegacyDraft(evaluation, { idFactory: testIdFactory, now: NOW });
    assert.equal(draft.requiredEvaluationSections.length, 12);
  });
});

// ─── legacyDraftToEvaluation ──────────────────────────────────────────────────

describe("legacyDraftToEvaluation", () => {
  it("produces an evaluation with required top-level fields", () => {
    const draft = makeMinimalDraft();
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    assert.ok(evaluation.id);
    assert.equal(evaluation.intakeId, "INTAKE-001");
    assert.equal(evaluation.depth, "standard");
    assert.equal(evaluation.evaluationVersion, 1);
    assert.equal(evaluation.createdAt, NOW);
    assert.deepEqual(evaluation.createdBy, ACTOR);
  });

  it("produces exactly 6 sections: intake_brief, work_breakdown, risk_security, cost_effort, synthesis, quality_review", () => {
    const draft = makeMinimalDraft();
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const kinds = evaluation.sections.map((s) => s.kind);
    assert.ok(kinds.includes("intake_brief"));
    assert.ok(kinds.includes("work_breakdown"));
    assert.ok(kinds.includes("risk_security"));
    assert.ok(kinds.includes("cost_effort"));
    assert.ok(kinds.includes("synthesis"));
    assert.ok(kinds.includes("quality_review"));
    assert.equal(evaluation.sections.length, 6);
  });

  it("maps draft.sourceSummary to intake_brief.normalizedSummary", () => {
    const draft = makeMinimalDraft();
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const brief = getSection(evaluation, "intake_brief");
    assert.equal(brief.content.normalizedSummary, "Build a KPI dashboard.");
  });

  it("maps draft.brief.problemStatement to intake_brief.rawSummary", () => {
    const draft = makeMinimalDraft();
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const brief = getSection(evaluation, "intake_brief");
    assert.equal(brief.content.rawSummary, "Need a KPI dashboard.");
  });

  it("maps subtasks with storyPoints * 4 as estimatedHours", () => {
    const draft = makeMinimalDraft();
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const wb = getSection(evaluation, "work_breakdown");
    assert.equal(wb.content.subtasks[0].estimatedHours, 12); // 3 * 4
  });

  it("maps draft.estimatedStoryPoints to cost_effort.estimatedStoryPoints", () => {
    const draft = makeMinimalDraft();
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const ce = getSection(evaluation, "cost_effort");
    assert.equal(ce.content.estimatedStoryPoints, 21);
  });

  it("maps confidence * 100 to qualityScore.overall", () => {
    const draft = makeMinimalDraft({ confidence: 0.83 });
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const qr = getSection(evaluation, "quality_review");
    assert.equal(qr.content.qualityScore.overall, 83);
  });

  it("sets status to needs_revision when draft has warnings", () => {
    const draft = makeMinimalDraft({ warnings: ["Needs clarification"] });
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    assert.equal(evaluation.status, "needs_revision");
  });

  it("sets status to ready_for_review when draft has no warnings", () => {
    const draft = makeMinimalDraft({ warnings: [] });
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    assert.equal(evaluation.status, "ready_for_review");
  });

  it("compliance notes with 'review' keyword sets securityReviewRequired true", () => {
    const draft = makeMinimalDraft({
      brief: {
        problemStatement: "Need KPI dashboard.",
        proposedSolution: "Build with React.",
        scope: [],
        deliverables: [],
        outOfScope: [],
        assumptions: [],
        complianceNotes: ["Security review required before distribution."],
      },
    });
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const risk = getSection(evaluation, "risk_security");
    assert.ok(risk.content.securityReviewRequired);
  });

  it("handles unknown complexity as medium", () => {
    const draft = makeMinimalDraft({ complexity: "unknown" });
    const evaluation = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const ce = getSection(evaluation, "cost_effort");
    assert.equal(ce.content.complexity, "medium");
  });
});

// ─── round-trip ───────────────────────────────────────────────────────────────

describe("round-trip: evaluation → draft → evaluation", () => {
  it("preserves intakeId through a full round-trip", () => {
    const originalEvaluation = {
      id: "EVAL-001",
      intakeId: "INTAKE-ROUNDTRIP",
      depth: "standard",
      sections: [makeIntakeBrief(), makeSynthesis(), makeQualityReview()],
      qualityScore: makeQualityReview().content.qualityScore,
      status: "ready_for_review",
      evaluationVersion: 1,
      createdAt: NOW,
      createdBy: ACTOR,
    };

    const draft = evaluationToLegacyDraft(originalEvaluation, { idFactory: testIdFactory, now: NOW });
    assert.equal(draft.intakeId, "INTAKE-ROUNDTRIP");

    const evaluation2 = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-ROUNDTRIP",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });
    assert.equal(evaluation2.intakeId, "INTAKE-ROUNDTRIP");
  });

  it("preserves summary content through a full round-trip", () => {
    const originalEvaluation = {
      id: "EVAL-001",
      intakeId: "INTAKE-001",
      depth: "standard",
      sections: [makeSynthesis(), makeWorkBreakdown(), makeCostEffort(), makeQualityReview()],
      qualityScore: makeQualityReview().content.qualityScore,
      status: "ready_for_review",
      evaluationVersion: 1,
      createdAt: NOW,
      createdBy: ACTOR,
    };

    const draft = evaluationToLegacyDraft(originalEvaluation, { idFactory: testIdFactory, now: NOW });
    const evaluation2 = legacyDraftToEvaluation(draft, {
      intakeId: "INTAKE-001",
      createdBy: ACTOR,
      idFactory: testIdFactory,
      now: NOW,
    });

    const brief2 = getSection(evaluation2, "intake_brief");
    assert.ok(brief2.content.normalizedSummary.length > 0);
  });
});

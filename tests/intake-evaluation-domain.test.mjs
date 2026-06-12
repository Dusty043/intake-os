import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluationSectionKinds,
  EVALUATION_DEPTH_ROUTING_TABLE,
  getSectionKindsForDepth,
  qualityBandFromScore,
  getSection,
  assertEvaluationSectionKind,
  validateEvaluationSection,
  validateIntakeEvaluation,
} from "../dist/src/application/intake-evaluation.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeSection(overrides = {}) {
  return {
    id: "SEC-001",
    evaluationId: "EVAL-001",
    kind: "intake_brief",
    content: {
      title: "Test",
      rawSummary: "raw",
      normalizedSummary: "normalized",
      statedGoals: [],
      successCriteria: [],
      knownConstraints: [],
    },
    version: 1,
    provenance: {
      provider: "mock",
      agentRole: "intake_brief",
      generatedAt: "2026-06-12T00:00:00.000Z",
    },
    ...overrides,
  };
}

function makeEvaluation(overrides = {}) {
  const section = makeSection();
  return {
    id: "EVAL-001",
    intakeId: "INTAKE-001",
    depth: "standard",
    sections: [section],
    status: "ready_for_review",
    evaluationVersion: 1,
    createdAt: "2026-06-12T00:00:00.000Z",
    createdBy: { id: "USER-001", email: "test@example.com", name: "Test User", role: "admin" },
    ...overrides,
  };
}

// ─── evaluationSectionKinds ───────────────────────────────────────────────────

describe("evaluationSectionKinds", () => {
  it("contains exactly 12 kinds", () => {
    assert.equal(evaluationSectionKinds.length, 12);
  });

  it("starts with intake_brief and ends with quality_review", () => {
    assert.equal(evaluationSectionKinds[0], "intake_brief");
    assert.equal(evaluationSectionKinds[evaluationSectionKinds.length - 1], "quality_review");
  });

  it("contains synthesis and quality_review", () => {
    assert.ok(evaluationSectionKinds.includes("synthesis"));
    assert.ok(evaluationSectionKinds.includes("quality_review"));
  });
});

// ─── EVALUATION_DEPTH_ROUTING_TABLE ──────────────────────────────────────────

describe("EVALUATION_DEPTH_ROUTING_TABLE", () => {
  it("light has 5 sections", () => {
    assert.equal(EVALUATION_DEPTH_ROUTING_TABLE.light.length, 5);
  });

  it("standard has 10 sections", () => {
    assert.equal(EVALUATION_DEPTH_ROUTING_TABLE.standard.length, 10);
  });

  it("full has 12 sections", () => {
    assert.equal(EVALUATION_DEPTH_ROUTING_TABLE.full.length, 12);
  });

  it("light is a subset of standard", () => {
    for (const kind of EVALUATION_DEPTH_ROUTING_TABLE.light) {
      assert.ok(EVALUATION_DEPTH_ROUTING_TABLE.standard.includes(kind), `${kind} not in standard`);
    }
  });

  it("standard is a subset of full", () => {
    for (const kind of EVALUATION_DEPTH_ROUTING_TABLE.standard) {
      assert.ok(EVALUATION_DEPTH_ROUTING_TABLE.full.includes(kind), `${kind} not in full`);
    }
  });

  it("all depths contain intake_brief and quality_review", () => {
    for (const depth of ["light", "standard", "full"]) {
      assert.ok(EVALUATION_DEPTH_ROUTING_TABLE[depth].includes("intake_brief"));
      assert.ok(EVALUATION_DEPTH_ROUTING_TABLE[depth].includes("quality_review"));
    }
  });
});

// ─── getSectionKindsForDepth ──────────────────────────────────────────────────

describe("getSectionKindsForDepth", () => {
  it("returns correct kinds for each depth", () => {
    assert.deepEqual(getSectionKindsForDepth("light"), EVALUATION_DEPTH_ROUTING_TABLE.light);
    assert.deepEqual(getSectionKindsForDepth("standard"), EVALUATION_DEPTH_ROUTING_TABLE.standard);
    assert.deepEqual(getSectionKindsForDepth("full"), EVALUATION_DEPTH_ROUTING_TABLE.full);
  });
});

// ─── qualityBandFromScore ─────────────────────────────────────────────────────

describe("qualityBandFromScore", () => {
  it("returns ready for score >= 90", () => {
    assert.equal(qualityBandFromScore(90), "ready");
    assert.equal(qualityBandFromScore(100), "ready");
    assert.equal(qualityBandFromScore(95), "ready");
  });

  it("returns usable for score >= 70 and < 90", () => {
    assert.equal(qualityBandFromScore(70), "usable");
    assert.equal(qualityBandFromScore(89), "usable");
    assert.equal(qualityBandFromScore(75), "usable");
  });

  it("returns needs_revision for score >= 50 and < 70", () => {
    assert.equal(qualityBandFromScore(50), "needs_revision");
    assert.equal(qualityBandFromScore(69), "needs_revision");
  });

  it("returns not_ready for score < 50", () => {
    assert.equal(qualityBandFromScore(49), "not_ready");
    assert.equal(qualityBandFromScore(0), "not_ready");
  });
});

// ─── getSection ───────────────────────────────────────────────────────────────

describe("getSection", () => {
  it("returns section by kind", () => {
    const evaluation = makeEvaluation();
    const section = getSection(evaluation, "intake_brief");
    assert.ok(section);
    assert.equal(section.kind, "intake_brief");
  });

  it("returns undefined when kind not present", () => {
    const evaluation = makeEvaluation();
    const section = getSection(evaluation, "synthesis");
    assert.equal(section, undefined);
  });

  it("skips superseded sections", () => {
    const old = makeSection({ id: "OLD", supersededById: "NEW" });
    const evaluation = makeEvaluation({ sections: [old] });
    const result = getSection(evaluation, "intake_brief");
    assert.equal(result, undefined);
  });

  it("returns active section when superseded and active both exist", () => {
    const old = makeSection({ id: "OLD", supersededById: "NEW" });
    const active = makeSection({ id: "NEW" });
    const evaluation = makeEvaluation({ sections: [old, active] });
    const result = getSection(evaluation, "intake_brief");
    assert.equal(result?.id, "NEW");
  });
});

// ─── assertEvaluationSectionKind ─────────────────────────────────────────────

describe("assertEvaluationSectionKind", () => {
  it("returns valid kind unchanged", () => {
    assert.equal(assertEvaluationSectionKind("intake_brief"), "intake_brief");
    assert.equal(assertEvaluationSectionKind("quality_review"), "quality_review");
  });

  it("throws for unknown kind", () => {
    assert.throws(() => assertEvaluationSectionKind("bogus"), /Unknown EvaluationSectionKind/);
  });
});

// ─── validateEvaluationSection ───────────────────────────────────────────────

describe("validateEvaluationSection", () => {
  it("passes for a valid intake_brief section", () => {
    assert.doesNotThrow(() => validateEvaluationSection(makeSection()));
  });

  it("throws when id is empty", () => {
    assert.throws(() => validateEvaluationSection(makeSection({ id: "" })), /id is required/);
  });

  it("throws when evaluationId is empty", () => {
    assert.throws(() => validateEvaluationSection(makeSection({ evaluationId: "" })), /evaluationId is required/);
  });

  it("throws when kind is unknown", () => {
    assert.throws(() => validateEvaluationSection(makeSection({ kind: "bad_kind" })), /Unknown EvaluationSection.kind/);
  });

  it("throws when version < 1", () => {
    assert.throws(() => validateEvaluationSection(makeSection({ version: 0 })), /version must be >= 1/);
  });

  it("throws when provenance.agentRole is missing", () => {
    const section = makeSection();
    section.provenance = { provider: "mock", generatedAt: "2026-06-12T00:00:00.000Z" };
    assert.throws(() => validateEvaluationSection(section), /agentRole is required/);
  });

  it("throws when content is not an object", () => {
    assert.throws(() => validateEvaluationSection(makeSection({ content: "not-object" })), /must be an object/);
  });

  it("validates quality_review readinessBand mismatch", () => {
    const section = makeSection({
      kind: "quality_review",
      provenance: { provider: "mock", agentRole: "quality_review", generatedAt: "2026-06-12T00:00:00.000Z" },
      content: {
        qualityScore: {
          dimensions: {
            completeness: 80, consistency: 80, specificity: 80,
            feasibility: 80, riskCoverage: 80, handoffReadiness: 80,
          },
          overall: 80,
          readinessBand: "ready", // wrong — should be "usable"
        },
        strengths: [],
        weaknesses: [],
        requiredRevisions: [],
        reviewerWarnings: [],
      },
    });
    assert.throws(() => validateEvaluationSection(section), /readinessBand "ready" does not match score 80/);
  });
});

// ─── validateIntakeEvaluation ─────────────────────────────────────────────────

describe("validateIntakeEvaluation", () => {
  it("passes for a valid evaluation", () => {
    assert.doesNotThrow(() => validateIntakeEvaluation(makeEvaluation()));
  });

  it("throws when id is empty", () => {
    assert.throws(() => validateIntakeEvaluation(makeEvaluation({ id: "" })), /id is required/);
  });

  it("throws when depth is invalid", () => {
    assert.throws(() => validateIntakeEvaluation(makeEvaluation({ depth: "extreme" })), /depth "extreme" is invalid/);
  });

  it("throws when evaluationVersion < 1", () => {
    assert.throws(() => validateIntakeEvaluation(makeEvaluation({ evaluationVersion: 0 })), /evaluationVersion must be >= 1/);
  });

  it("throws when duplicate active sections exist", () => {
    const s1 = makeSection({ id: "SEC-001" });
    const s2 = makeSection({ id: "SEC-002" });
    const evaluation = makeEvaluation({ sections: [s1, s2] });
    assert.throws(() => validateIntakeEvaluation(evaluation), /duplicate active sections/);
  });

  it("allows superseded + active of same kind", () => {
    const old = makeSection({ id: "OLD", supersededById: "NEW" });
    const active = makeSection({ id: "NEW" });
    const evaluation = makeEvaluation({ sections: [old, active] });
    assert.doesNotThrow(() => validateIntakeEvaluation(evaluation));
  });
});

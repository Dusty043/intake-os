import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluationSectionKinds } from "../dist/src/application/intake-evaluation.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeIntakeRecord(overrides = {}) {
  return {
    id: "INTAKE-001",
    title: "Test Project",
    description: "A test project for contract validation.",
    projectType: "internal_tool",
    status: "submitted",
    submittedAt: "2026-06-12T00:00:00.000Z",
    submittedBy: { id: "USER-001", email: "user@example.com", name: "User", role: "submitter" },
    ...overrides,
  };
}

function makeRunContext(overrides = {}) {
  return {
    intake: makeIntakeRecord(),
    depth: "standard",
    sections: {},
    ...overrides,
  };
}

function makeRunOptions(overrides = {}) {
  return {
    actor: { id: "USER-001", email: "user@example.com", name: "User", role: "admin" },
    provider: "mock",
    idFactory: (prefix) => `${prefix}-TEST-001`,
    now: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

function makeAgentOutput(sectionKind, content, overrides = {}) {
  return {
    sectionKind,
    content,
    confidence: 0.85,
    warnings: [],
    ...overrides,
  };
}

// ─── AgentRunContext shape ────────────────────────────────────────────────────

describe("AgentRunContext shape", () => {
  it("requires intake, depth, and sections", () => {
    const ctx = makeRunContext();
    assert.ok(ctx.intake);
    assert.ok(ctx.depth);
    assert.ok(ctx.sections !== undefined);
  });

  it("accepts optional discoveryNotes", () => {
    const ctx = makeRunContext({ discoveryNotes: ["Note A", "Note B"] });
    assert.deepEqual(ctx.discoveryNotes, ["Note A", "Note B"]);
  });

  it("accepts optional priorClarifications", () => {
    const ctx = makeRunContext({
      priorClarifications: [{ question: "Q?", answer: "A." }],
    });
    assert.equal(ctx.priorClarifications.length, 1);
    assert.equal(ctx.priorClarifications[0].question, "Q?");
  });

  it("accepts optional projectTypeClassification", () => {
    const classification = {
      projectType: "internal_tool",
      confidence: 0.9,
      reasoning: "Looks internal",
      recommendedDepth: "standard",
      signals: [],
    };
    const ctx = makeRunContext({ projectTypeClassification: classification });
    assert.equal(ctx.projectTypeClassification.projectType, "internal_tool");
  });

  it("sections is a partial record keyed by EvaluationSectionKind", () => {
    const ctx = makeRunContext({
      sections: {
        intake_brief: {
          id: "SEC-001",
          evaluationId: "EVAL-001",
          kind: "intake_brief",
          content: {
            title: "T", rawSummary: "r", normalizedSummary: "n",
            statedGoals: [], successCriteria: [], knownConstraints: [],
          },
          version: 1,
          provenance: { provider: "mock", agentRole: "intake_brief", generatedAt: "2026-06-12T00:00:00.000Z" },
        },
      },
    });
    assert.ok(ctx.sections.intake_brief);
    assert.equal(ctx.sections.synthesis, undefined);
  });
});

// ─── AgentRunOptions shape ────────────────────────────────────────────────────

describe("AgentRunOptions shape", () => {
  it("has all required fields", () => {
    const opts = makeRunOptions();
    assert.ok(opts.actor);
    assert.ok(opts.provider);
    assert.equal(typeof opts.idFactory, "function");
    assert.ok(opts.now);
  });

  it("idFactory generates prefixed IDs", () => {
    const opts = makeRunOptions({ idFactory: (p) => `${p}-XYZ` });
    assert.equal(opts.idFactory("EVAL"), "EVAL-XYZ");
    assert.equal(opts.idFactory("SECTION"), "SECTION-XYZ");
  });

  it("accepts all valid providers", () => {
    for (const provider of ["mock", "openai", "anthropic", "bedrock"]) {
      const opts = makeRunOptions({ provider });
      assert.equal(opts.provider, provider);
    }
  });

  it("accepts optional model", () => {
    const opts = makeRunOptions({ model: "gpt-4o" });
    assert.equal(opts.model, "gpt-4o");
  });
});

// ─── AgentOutput shape ────────────────────────────────────────────────────────

describe("AgentOutput shape", () => {
  it("has sectionKind, content, confidence, and warnings", () => {
    const output = makeAgentOutput("intake_brief", { rawSummary: "r", normalizedSummary: "n", title: "T", statedGoals: [], successCriteria: [], knownConstraints: [] });
    assert.equal(output.sectionKind, "intake_brief");
    assert.ok(output.content);
    assert.equal(typeof output.confidence, "number");
    assert.ok(Array.isArray(output.warnings));
  });

  it("confidence is between 0 and 1 inclusive", () => {
    for (const confidence of [0, 0.5, 1]) {
      const output = makeAgentOutput("synthesis", {}, { confidence });
      assert.ok(output.confidence >= 0 && output.confidence <= 1, `confidence ${confidence} out of range`);
    }
  });

  it("accepts isClarificationBlocking flag", () => {
    const output = makeAgentOutput("clarification_questions", {}, { isClarificationBlocking: true });
    assert.equal(output.isClarificationBlocking, true);
  });

  it("accepts optional usage object", () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      estimatedCostUsd: 0.005,
      latencyMs: 1200,
    };
    const output = makeAgentOutput("synthesis", {}, { usage });
    assert.equal(output.usage.totalTokens, 300);
    assert.equal(output.usage.latencyMs, 1200);
  });

  it("sectionKind must be a valid EvaluationSectionKind", () => {
    for (const kind of evaluationSectionKinds) {
      const output = makeAgentOutput(kind, {});
      assert.ok(evaluationSectionKinds.includes(output.sectionKind), `${kind} should be valid`);
    }
  });
});

// ─── EvaluationAgent interface contract ──────────────────────────────────────

describe("EvaluationAgent interface contract", () => {
  it("an agent implementing the interface has a role and a run method", () => {
    // Build a minimal inline mock agent conforming to the interface
    const mockAgent = {
      role: "synthesis",
      run: async (ctx, opts) => {
        return {
          sectionKind: "synthesis",
          content: {
            executiveSummary: "Summary",
            recommendedPath: "Path",
            keyDecisions: [],
            reviewNotes: [],
            approvalReadinessSummary: "Ready",
          },
          confidence: 0.9,
          warnings: [],
        };
      },
    };

    assert.equal(mockAgent.role, "synthesis");
    assert.equal(typeof mockAgent.run, "function");
  });

  it("run returns an AgentOutput with the matching sectionKind", async () => {
    const mockAgent = {
      role: "work_breakdown",
      run: async (_ctx, _opts) => ({
        sectionKind: "work_breakdown",
        content: { subtasks: [], milestones: [], dependencies: [] },
        confidence: 0.75,
        warnings: ["No subtasks found"],
      }),
    };

    const ctx = makeRunContext();
    const opts = makeRunOptions();
    const output = await mockAgent.run(ctx, opts);

    assert.equal(output.sectionKind, mockAgent.role);
    assert.ok(Array.isArray(output.warnings));
  });
});

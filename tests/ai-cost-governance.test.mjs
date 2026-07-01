/**
 * TASK-0030: AI Cost Governance
 * Tests: model-cost-registry, estimateCost, InMemoryStore.listAllAgentRuns
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  estimateCost,
  parseOptionalFloat,
  loadModelCostConfig,
  InMemoryProjectIntakeStore,
} from "../dist/src/index.js";

// ---------------------------------------------------------------------------
// estimateCost
// ---------------------------------------------------------------------------

describe("estimateCost", () => {
  test("returns correct cost for known token counts", () => {
    const cost = estimateCost(1_000_000, 500_000, {
      inputCostPer1MTokens: 2.00,
      outputCostPer1MTokens: 8.00,
    });
    assert.equal(cost, 6.0); // 2.00 + 4.00
  });

  test("returns null when input cost is null", () => {
    const cost = estimateCost(1000, 500, {
      inputCostPer1MTokens: null,
      outputCostPer1MTokens: 8.00,
    });
    assert.equal(cost, null);
  });

  test("returns null when output cost is null", () => {
    const cost = estimateCost(1000, 500, {
      inputCostPer1MTokens: 2.00,
      outputCostPer1MTokens: null,
    });
    assert.equal(cost, null);
  });

  test("returns null when both costs are null", () => {
    const cost = estimateCost(1000, 500, {
      inputCostPer1MTokens: null,
      outputCostPer1MTokens: null,
    });
    assert.equal(cost, null);
  });

  test("rounds to 6 decimal places", () => {
    const cost = estimateCost(1, 1, {
      inputCostPer1MTokens: 2.50,
      outputCostPer1MTokens: 10.00,
    });
    assert.ok(typeof cost === "number");
    const parts = String(cost).split(".");
    if (parts[1]) assert.ok(parts[1].length <= 6);
  });

  test("zero tokens produces zero cost", () => {
    const cost = estimateCost(0, 0, {
      inputCostPer1MTokens: 5.00,
      outputCostPer1MTokens: 20.00,
    });
    assert.equal(cost, 0);
  });
});

// ---------------------------------------------------------------------------
// parseOptionalFloat
// ---------------------------------------------------------------------------

describe("parseOptionalFloat", () => {
  test("parses valid float string", () => {
    assert.equal(parseOptionalFloat("3.14"), 3.14);
  });

  test("returns null for undefined", () => {
    assert.equal(parseOptionalFloat(undefined), null);
  });

  test("returns null for empty string", () => {
    assert.equal(parseOptionalFloat(""), null);
  });

  test("returns null for non-numeric string", () => {
    assert.equal(parseOptionalFloat("abc"), null);
  });
});

// ---------------------------------------------------------------------------
// loadModelCostConfig — built-in defaults
// ---------------------------------------------------------------------------

describe("loadModelCostConfig — built-in defaults", () => {
  afterEach(() => {
    delete process.env.COST_INPUT_GPT_4O;
    delete process.env.COST_OUTPUT_GPT_4O;
    delete process.env.COST_INPUT_CLAUDE_SONNET_4_6;
    delete process.env.COST_OUTPUT_CLAUDE_SONNET_4_6;
    delete process.env.COST_INPUT_UNKNOWN_MODEL;
    delete process.env.COST_OUTPUT_UNKNOWN_MODEL;
  });

  test("returns known defaults for gpt-4o", () => {
    const cfg = loadModelCostConfig("gpt-4o");
    assert.equal(cfg.inputCostPer1MTokens, 2.50);
    assert.equal(cfg.outputCostPer1MTokens, 10.00);
  });

  test("returns known defaults for gpt-4o-mini", () => {
    const cfg = loadModelCostConfig("gpt-4o-mini");
    assert.equal(cfg.inputCostPer1MTokens, 0.15);
    assert.equal(cfg.outputCostPer1MTokens, 0.60);
  });

  test("returns known defaults for claude-sonnet-4-6", () => {
    const cfg = loadModelCostConfig("claude-sonnet-4-6");
    assert.equal(cfg.inputCostPer1MTokens, 3.00);
    assert.equal(cfg.outputCostPer1MTokens, 15.00);
  });

  test("returns known defaults for gpt-5.5", () => {
    const cfg = loadModelCostConfig("gpt-5.5");
    assert.equal(cfg.inputCostPer1MTokens, 5.00);
    assert.equal(cfg.outputCostPer1MTokens, 30.00);
  });

  test("returns known defaults for gpt-5.4-mini", () => {
    const cfg = loadModelCostConfig("gpt-5.4-mini");
    assert.equal(cfg.inputCostPer1MTokens, 0.75);
    assert.equal(cfg.outputCostPer1MTokens, 4.50);
  });

  test("returns known defaults for gpt-5.4-nano", () => {
    const cfg = loadModelCostConfig("gpt-5.4-nano");
    assert.equal(cfg.inputCostPer1MTokens, 0.20);
    assert.equal(cfg.outputCostPer1MTokens, 1.25);
  });

  test("returns null costs for unknown model with no env var", () => {
    const cfg = loadModelCostConfig("completely-unknown-model-xyz");
    assert.equal(cfg.inputCostPer1MTokens, null);
    assert.equal(cfg.outputCostPer1MTokens, null);
  });
});

// ---------------------------------------------------------------------------
// loadModelCostConfig — env-var overrides
// ---------------------------------------------------------------------------

describe("loadModelCostConfig — env-var overrides", () => {
  afterEach(() => {
    delete process.env.COST_INPUT_GPT_4O;
    delete process.env.COST_OUTPUT_GPT_4O;
    delete process.env.COST_INPUT_MY_CUSTOM_MODEL;
    delete process.env.COST_OUTPUT_MY_CUSTOM_MODEL;
  });

  test("COST_INPUT_<SLUG> overrides built-in default", () => {
    process.env.COST_INPUT_GPT_4O = "99.00";
    process.env.COST_OUTPUT_GPT_4O = "200.00";
    const cfg = loadModelCostConfig("gpt-4o");
    assert.equal(cfg.inputCostPer1MTokens, 99.00);
    assert.equal(cfg.outputCostPer1MTokens, 200.00);
  });

  test("env var provides cost for otherwise-unknown model", () => {
    process.env.COST_INPUT_MY_CUSTOM_MODEL = "1.50";
    process.env.COST_OUTPUT_MY_CUSTOM_MODEL = "6.00";
    const cfg = loadModelCostConfig("my-custom-model");
    assert.equal(cfg.inputCostPer1MTokens, 1.50);
    assert.equal(cfg.outputCostPer1MTokens, 6.00);
  });

  test("model name slug uses uppercase with underscores", () => {
    // "gpt-4o-mini" → "GPT_4O_MINI"
    process.env.COST_INPUT_GPT_4O_MINI = "5.00";
    process.env.COST_OUTPUT_GPT_4O_MINI = "20.00";
    const cfg = loadModelCostConfig("gpt-4o-mini");
    assert.equal(cfg.inputCostPer1MTokens, 5.00);
    delete process.env.COST_INPUT_GPT_4O_MINI;
    delete process.env.COST_OUTPUT_GPT_4O_MINI;
  });
});

// ---------------------------------------------------------------------------
// InMemoryProjectIntakeStore.listAllAgentRuns
// ---------------------------------------------------------------------------

describe("listAllAgentRuns", () => {
  // Minimal valid synthesis section (requires executiveSummary + recommendedPath)
  function makeSynthesisSection(evaluationId, sectionId) {
    const now = new Date().toISOString();
    return {
      id: sectionId,
      evaluationId,
      kind: "synthesis",
      content: {
        executiveSummary: "A brief summary.",
        recommendedPath: "custom_build",
      },
      version: 1,
      supersededById: undefined,
      provenance: {
        provider: "mock",
        agentRole: "synthesis",
        generatedAt: now,
        model: "gpt-4o",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.0008,
      },
    };
  }

  function makeBundle(evaluationId, intakeId, extraAgentRuns = []) {
    const now = new Date().toISOString();
    const sectionId = `sec-${evaluationId}`;
    return {
      evaluation: {
        id: evaluationId,
        intakeId,
        depth: "light",
        status: "complete",
        evaluationVersion: 1,
        createdAt: now,
        createdBy: { id: "u1", role: "admin" },
        sections: [makeSynthesisSection(evaluationId, sectionId)],
      },
      // Pass explicit agentRuns so we control count without needing valid sections for each role
      agentRuns: [
        {
          id: `run-${sectionId}`,
          evaluationId,
          sectionId,
          agentRole: "synthesis",
          provider: "mock",
          model: "gpt-4o",
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCostUsd: 0.0008,
          status: "success",
          createdAt: now,
        },
        ...extraAgentRuns.map((role, i) => ({
          id: `run-extra-${evaluationId}-${i}`,
          evaluationId,
          agentRole: role,
          provider: "mock",
          model: "gpt-4o",
          inputTokens: 80,
          outputTokens: 40,
          totalTokens: 120,
          estimatedCostUsd: 0.0006,
          status: "success",
          createdAt: now,
        })),
      ],
    };
  }

  test("returns all agent runs with intakeId attached", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation(makeBundle("eval-1", "intake-A"));
    await store.saveEvaluation(makeBundle("eval-2", "intake-B"));

    const all = await store.listAllAgentRuns();
    assert.ok(all.length >= 2);
    assert.ok(all.every((r) => typeof r.intakeId === "string"));
  });

  test("filters by intakeId", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveEvaluation(makeBundle("eval-1", "intake-A"));
    await store.saveEvaluation(makeBundle("eval-2", "intake-B"));

    const filtered = await store.listAllAgentRuns({ intakeId: "intake-A" });
    assert.ok(filtered.length >= 1);
    assert.ok(filtered.every((r) => r.intakeId === "intake-A"));
  });

  test("returns empty array when intakeId has no evaluations", async () => {
    const store = new InMemoryProjectIntakeStore();
    const result = await store.listAllAgentRuns({ intakeId: "no-such-intake" });
    assert.equal(result.length, 0);
  });

  test("multiple explicit agent runs per evaluation all included", async () => {
    const store = new InMemoryProjectIntakeStore();
    // base section run + 2 extra = 3 total
    await store.saveEvaluation(makeBundle("eval-multi", "intake-C", [
      "risk_security",
      "work_breakdown",
    ]));
    const runs = await store.listAllAgentRuns({ intakeId: "intake-C" });
    assert.equal(runs.length, 3);
  });
});

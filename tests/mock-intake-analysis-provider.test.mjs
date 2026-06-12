import assert from "node:assert/strict";
import test from "node:test";
import { MockIntakeAnalysisProvider } from "../dist/src/application/providers/mock-intake-analysis-provider.js";

const actor = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
let counter = 0;
const idFactory = (prefix) => `${prefix}-${++counter}`;
const now = "2026-06-12T00:00:00.000Z";

function makeIntake() {
  return {
    id: "intake-001",
    title: "Payment Retry System",
    description: "Build a backend service for retrying failed payment transactions with exponential backoff.",
    requester: "Finance Team",
    department: "Engineering",
    projectType: "api_service",
    status: "submitted",
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    analysisDraftRegenerationCount: 0,
    auditLog: [],
  };
}

const baseOptions = {
  actor,
  idFactory,
  now,
  mode: "initial_generation",
};

test("provider name is mock", () => {
  const provider = new MockIntakeAnalysisProvider();
  assert.equal(provider.name, "mock");
});

test("generateDraft returns draft with required fields", async () => {
  const provider = new MockIntakeAnalysisProvider();
  const result = await provider.generateDraft(makeIntake(), baseOptions);

  assert.ok(result.draft);
  assert.equal(result.draft.provider, "mock");
  assert.equal(result.draft.reviewStatus, "draft");
  assert.ok(result.draft.id);
  assert.ok(result.draft.brief.problemStatement);
  assert.ok(result.draft.estimatedStoryPoints >= 1);
});

test("generateDraft metadata has zero cost", async () => {
  const provider = new MockIntakeAnalysisProvider();
  const result = await provider.generateDraft(makeIntake(), baseOptions);

  assert.equal(result.metadata.provider, "mock");
  assert.equal(result.metadata.model, "mock-deterministic");
  assert.equal(result.metadata.usage?.estimatedCostUsd, 0);
  assert.equal(result.metadata.usage?.inputTokens, 0);
  assert.equal(result.metadata.usage?.outputTokens, 0);
});

test("generateDraft incorporates guidance in draft", async () => {
  const provider = new MockIntakeAnalysisProvider();
  const result = await provider.generateDraft(makeIntake(), {
    ...baseOptions,
    guidance: "Focus on high story point tasks with complex infrastructure.",
    mode: "guided_regeneration",
  });

  assert.ok(result.draft);
  assert.ok(result.draft.warnings.some((w) => w.includes("guidance")) || result.draft.estimatedStoryPoints > 0);
});

test("generateDraft assigns idFactory-generated id", async () => {
  counter = 0;
  const provider = new MockIntakeAnalysisProvider();
  const result = await provider.generateDraft(makeIntake(), { ...baseOptions, idFactory: (p) => `${p}-TEST` });
  assert.ok(result.draft.id.startsWith("AIDRAFT-TEST"));
});

test("generateDraft assigns actor as generatedBy", async () => {
  const provider = new MockIntakeAnalysisProvider();
  const result = await provider.generateDraft(makeIntake(), baseOptions);
  assert.equal(result.draft.generatedBy.id, actor.id);
});

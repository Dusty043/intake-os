import assert from "node:assert/strict";
import test from "node:test";
import { AnthropicIntakeAnalysisProvider } from "../dist/src/application/providers/anthropic-intake-analysis-provider.js";
import {
  ProviderInvocationError,
  ProviderResponseValidationError,
} from "../dist/src/index.js";

const actor = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
let counter = 0;
const idFactory = (prefix) => `${prefix}-${++counter}`;
const now = "2026-06-12T00:00:00.000Z";

const baseConfig = {
  apiKey: "sk-ant-test",
  model: "claude-3-5-haiku-latest",
  maxOutputTokens: 2500,
  temperature: 0.2,
  inputCostPer1MTokens: 0.8,
  outputCostPer1MTokens: 4.0,
};

const baseOptions = { actor, idFactory, now, mode: "initial_generation" };

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

const validModelOutput = {
  summary: "Payment retry system with exponential backoff.",
  problemStatement: "Failed payments are not retried automatically.",
  proposedSolution: "Build a retry service with configurable backoff.",
  scope: { inScope: ["retry logic", "audit logging"], outOfScope: ["payment gateway changes"] },
  deliverables: ["Retry service", "Admin dashboard"],
  assumptions: ["PostgreSQL available"],
  complianceNotes: ["PCI-DSS logging required"],
  recommendedSubtasks: [
    {
      title: "Implement retry queue",
      description: "Build queue with exponential backoff.",
      storyPoints: 5,
      acceptanceCriteria: ["Retries up to 5 times"],
    },
  ],
  recommendedTechStack: ["Node.js", "PostgreSQL", "Redis"],
  infrastructureRequirements: [
    { kind: "database", required: true, description: "PostgreSQL", rationale: "Persistence" },
  ],
  risks: ["PCI compliance complexity"],
  complexity: "medium",
  estimatedStoryPoints: 13,
  confidenceScore: 0.85,
  missingInformation: [],
  warnings: [],
  projectType: "api_service",
};

const TOOL_NAME = "emit_intake_analysis_draft";

function makeStubClient(resolveWith) {
  return { messages: { create: async () => resolveWith } };
}

function makeErrorClient(error) {
  return { messages: { create: async () => { throw error; } } };
}

test("provider name is anthropic", () => {
  const provider = new AnthropicIntakeAnalysisProvider(baseConfig, makeStubClient(null));
  assert.equal(provider.name, "anthropic");
});

test("generateDraft returns draft and metadata on success", async () => {
  const stubResponse = {
    id: "msg-123",
    content: [{ type: "tool_use", name: TOOL_NAME, input: validModelOutput }],
    stop_reason: "tool_use",
    usage: { input_tokens: 400, output_tokens: 180 },
  };

  counter = 0;
  const provider = new AnthropicIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  const result = await provider.generateDraft(makeIntake(), baseOptions);

  assert.equal(result.metadata.provider, "anthropic");
  assert.equal(result.metadata.model, "claude-3-5-haiku-latest");
  assert.equal(result.metadata.requestId, "msg-123");
  assert.equal(result.metadata.finishReason, "tool_use");
  assert.equal(result.metadata.usage?.inputTokens, 400);
  assert.equal(result.metadata.usage?.outputTokens, 180);
  assert.ok(typeof result.metadata.usage?.estimatedCostUsd === "number");
  assert.equal(result.draft.reviewStatus, "draft");
  assert.equal(result.draft.provider, "anthropic");
});

test("throws ProviderInvocationError when client throws", async () => {
  const provider = new AnthropicIntakeAnalysisProvider(baseConfig, makeErrorClient(new Error("rate limit")));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderInvocationError && err.message.includes("rate limit"),
  );
});

test("throws ProviderResponseValidationError when tool_use block is missing", async () => {
  const stubResponse = {
    id: "msg-notool",
    content: [{ type: "text", text: "I cannot help with that." }],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 20 },
  };
  const provider = new AnthropicIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderResponseValidationError && err.message.includes(TOOL_NAME),
  );
});

test("throws ProviderResponseValidationError when tool input is invalid schema", async () => {
  const stubResponse = {
    id: "msg-badschema",
    content: [{ type: "tool_use", name: TOOL_NAME, input: { summary: "only summary" } }],
    stop_reason: "tool_use",
    usage: { input_tokens: 100, output_tokens: 20 },
  };
  const provider = new AnthropicIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderResponseValidationError,
  );
});

test("estimatedCostUsd is null when cost rates are not provided", async () => {
  const noCostConfig = { ...baseConfig, inputCostPer1MTokens: null, outputCostPer1MTokens: null };
  const stubResponse = {
    id: "msg-nocost",
    content: [{ type: "tool_use", name: TOOL_NAME, input: validModelOutput }],
    stop_reason: "tool_use",
    usage: { input_tokens: 100, output_tokens: 50 },
  };
  counter = 0;
  const provider = new AnthropicIntakeAnalysisProvider(noCostConfig, makeStubClient(stubResponse));
  const result = await provider.generateDraft(makeIntake(), baseOptions);
  assert.equal(result.metadata.usage?.estimatedCostUsd, null);
});

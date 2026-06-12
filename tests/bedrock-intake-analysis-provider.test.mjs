import assert from "node:assert/strict";
import test from "node:test";
import { BedrockIntakeAnalysisProvider } from "../dist/src/application/providers/bedrock-intake-analysis-provider.js";
import {
  ProviderInvocationError,
  ProviderResponseValidationError,
} from "../dist/src/index.js";

const actor = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
let counter = 0;
const idFactory = (prefix) => `${prefix}-${++counter}`;
const now = "2026-06-12T00:00:00.000Z";

const baseConfig = {
  region: "us-east-1",
  modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  maxOutputTokens: 2500,
  temperature: 0.2,
  inputCostPer1MTokens: 3.0,
  outputCostPer1MTokens: 15.0,
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
  return { send: async () => resolveWith };
}

function makeErrorClient(error) {
  return { send: async () => { throw error; } };
}

test("provider name is bedrock", () => {
  const provider = new BedrockIntakeAnalysisProvider(baseConfig, makeStubClient(null));
  assert.equal(provider.name, "bedrock");
});

test("generateDraft returns draft and metadata on success", async () => {
  const stubResponse = {
    output: {
      message: {
        content: [{ toolUse: { name: TOOL_NAME, input: validModelOutput } }],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 450, outputTokens: 200, totalTokens: 650 },
  };

  counter = 0;
  const provider = new BedrockIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  const result = await provider.generateDraft(makeIntake(), baseOptions);

  assert.equal(result.metadata.provider, "bedrock");
  assert.equal(result.metadata.model, baseConfig.modelId);
  assert.equal(result.metadata.finishReason, "tool_use");
  assert.equal(result.metadata.usage?.inputTokens, 450);
  assert.equal(result.metadata.usage?.outputTokens, 200);
  assert.ok(typeof result.metadata.usage?.estimatedCostUsd === "number");
  assert.equal(result.draft.reviewStatus, "draft");
  assert.equal(result.draft.provider, "bedrock");
});

test("throws ProviderInvocationError when client throws", async () => {
  const provider = new BedrockIntakeAnalysisProvider(baseConfig, makeErrorClient(new Error("throttling")));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderInvocationError && err.message.includes("throttling"),
  );
});

test("throws ProviderResponseValidationError when tool_use block is missing", async () => {
  const stubResponse = {
    output: { message: { content: [{ text: { value: "some text" } }] } },
    stopReason: "end_turn",
    usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
  };
  const provider = new BedrockIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderResponseValidationError && err.message.includes(TOOL_NAME),
  );
});

test("throws ProviderResponseValidationError when tool input is invalid schema", async () => {
  const stubResponse = {
    output: {
      message: {
        content: [{ toolUse: { name: TOOL_NAME, input: { summary: "partial" } } }],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
  };
  const provider = new BedrockIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderResponseValidationError,
  );
});

test("estimatedCostUsd is null when cost rates are not provided", async () => {
  const noCostConfig = { ...baseConfig, inputCostPer1MTokens: null, outputCostPer1MTokens: null };
  const stubResponse = {
    output: {
      message: {
        content: [{ toolUse: { name: TOOL_NAME, input: validModelOutput } }],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  };
  counter = 0;
  const provider = new BedrockIntakeAnalysisProvider(noCostConfig, makeStubClient(stubResponse));
  const result = await provider.generateDraft(makeIntake(), baseOptions);
  assert.equal(result.metadata.usage?.estimatedCostUsd, null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIIntakeAnalysisProvider } from "../dist/src/application/providers/openai-intake-analysis-provider.js";
import {
  ProviderInvocationError,
  ProviderResponseValidationError,
} from "../dist/src/index.js";

const actor = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
let counter = 0;
const idFactory = (prefix) => `${prefix}-${++counter}`;
const now = "2026-06-12T00:00:00.000Z";

const baseConfig = {
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  maxOutputTokens: 2500,
  temperature: 0.2,
  inputCostPer1MTokens: 0.15,
  outputCostPer1MTokens: 0.6,
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
  proposedArchitecture: "Stateless NestJS REST service backed by PostgreSQL. Redis queue for retry scheduling with exponential backoff. OpenAPI spec generated from decorators.",
  implementationSuggestions: ["Start with the retry queue worker before the HTTP layer.", "Use idempotency keys on all payment retries."],
  definitionOfDone: "The API is deployed, all documented endpoints return correct responses, and consumer teams can authenticate and make calls without guidance.",
  openQuestions: [{ question: "Which teams are the primary consumers?", askedOf: "Engineering leads", blocking: false }],
  keyDependencies: [{ item: "Postgres database provisioned", reason: "Migrations run at startup.", blocking: true }],
};

function makeStubClient(resolveWith) {
  return {
    chat: {
      completions: {
        create: async () => resolveWith,
      },
    },
  };
}

function makeErrorClient(error) {
  return {
    chat: {
      completions: {
        create: async () => { throw error; },
      },
    },
  };
}

test("provider name is openai", () => {
  const provider = new OpenAIIntakeAnalysisProvider(baseConfig, makeStubClient(null));
  assert.equal(provider.name, "openai");
});

test("generateDraft returns draft and metadata on success", async () => {
  const stubResponse = {
    id: "chatcmpl-123",
    choices: [
      {
        message: { content: JSON.stringify(validModelOutput) },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
  };

  counter = 0;
  const provider = new OpenAIIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  const result = await provider.generateDraft(makeIntake(), baseOptions);

  assert.equal(result.metadata.provider, "openai");
  assert.equal(result.metadata.model, "gpt-4o-mini");
  assert.equal(result.metadata.requestId, "chatcmpl-123");
  assert.equal(result.metadata.finishReason, "stop");
  assert.equal(result.metadata.usage?.inputTokens, 500);
  assert.equal(result.metadata.usage?.outputTokens, 200);
  assert.ok(typeof result.metadata.usage?.estimatedCostUsd === "number");
  assert.equal(result.draft.reviewStatus, "draft");
  assert.equal(result.draft.provider, "openai");
});

test("throws ProviderInvocationError when client throws", async () => {
  const provider = new OpenAIIntakeAnalysisProvider(baseConfig, makeErrorClient(new Error("network error")));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderInvocationError && err.message.includes("network error"),
  );
});

test("throws ProviderResponseValidationError for empty response content", async () => {
  const stubResponse = {
    id: "chatcmpl-empty",
    choices: [{ message: { content: null }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
  };
  const provider = new OpenAIIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderResponseValidationError && err.message.includes("Empty response"),
  );
});

test("throws ProviderResponseValidationError for invalid JSON", async () => {
  const stubResponse = {
    id: "chatcmpl-badjson",
    choices: [{ message: { content: "not json" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
  const provider = new OpenAIIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderResponseValidationError && err.message.includes("not valid JSON"),
  );
});

test("throws ProviderResponseValidationError when schema is invalid", async () => {
  const badOutput = { summary: "ok" };
  const stubResponse = {
    id: "chatcmpl-badschema",
    choices: [{ message: { content: JSON.stringify(badOutput) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
  const provider = new OpenAIIntakeAnalysisProvider(baseConfig, makeStubClient(stubResponse));
  await assert.rejects(
    () => provider.generateDraft(makeIntake(), baseOptions),
    (err) => err instanceof ProviderResponseValidationError,
  );
});

test("estimatedCostUsd is null when cost rates are not provided", async () => {
  const noCostConfig = { ...baseConfig, inputCostPer1MTokens: null, outputCostPer1MTokens: null };
  const stubResponse = {
    id: "chatcmpl-nocost",
    choices: [{ message: { content: JSON.stringify(validModelOutput) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
  counter = 0;
  const provider = new OpenAIIntakeAnalysisProvider(noCostConfig, makeStubClient(stubResponse));
  const result = await provider.generateDraft(makeIntake(), baseOptions);
  assert.equal(result.metadata.usage?.estimatedCostUsd, null);
});

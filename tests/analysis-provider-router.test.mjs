import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisProviderRouter } from "../dist/src/application/providers/analysis-provider-router.js";
import { ConfigurationError } from "../dist/src/index.js";

test("router name is mock when provider=mock", () => {
  const router = new AnalysisProviderRouter({ provider: "mock", maxInputChars: 12000, maxOutputTokens: 2500, temperature: 0.2, costTrackingEnabled: false, auditStorePrompt: false });
  assert.equal(router.name, "mock");
});

test("router throws ConfigurationError when openai config is missing", () => {
  assert.throws(
    () => new AnalysisProviderRouter({ provider: "openai", maxInputChars: 12000, maxOutputTokens: 2500, temperature: 0.2, costTrackingEnabled: false, auditStorePrompt: false }),
    (err) => err instanceof ConfigurationError,
  );
});

test("router throws ConfigurationError when anthropic config is missing", () => {
  assert.throws(
    () => new AnalysisProviderRouter({ provider: "anthropic", maxInputChars: 12000, maxOutputTokens: 2500, temperature: 0.2, costTrackingEnabled: false, auditStorePrompt: false }),
    (err) => err instanceof ConfigurationError,
  );
});

test("router throws ConfigurationError when bedrock config is missing", () => {
  assert.throws(
    () => new AnalysisProviderRouter({ provider: "bedrock", maxInputChars: 12000, maxOutputTokens: 2500, temperature: 0.2, costTrackingEnabled: false, auditStorePrompt: false }),
    (err) => err instanceof ConfigurationError,
  );
});

test("router creates openai provider when openai config provided", () => {
  const router = new AnalysisProviderRouter({
    provider: "openai",
    maxInputChars: 12000,
    maxOutputTokens: 2500,
    temperature: 0.2,
    costTrackingEnabled: false,
    auditStorePrompt: false,
    openai: { apiKey: "sk-test", model: "gpt-4o-mini", inputCostPer1MTokens: null, outputCostPer1MTokens: null },
  });
  assert.equal(router.name, "openai");
});

test("router creates anthropic provider when anthropic config provided", () => {
  const router = new AnalysisProviderRouter({
    provider: "anthropic",
    maxInputChars: 12000,
    maxOutputTokens: 2500,
    temperature: 0.2,
    costTrackingEnabled: false,
    auditStorePrompt: false,
    anthropic: { apiKey: "sk-ant-test", model: "claude-3-5-haiku-latest", inputCostPer1MTokens: null, outputCostPer1MTokens: null },
  });
  assert.equal(router.name, "anthropic");
});

test("router creates bedrock provider when bedrock config provided", () => {
  const router = new AnalysisProviderRouter({
    provider: "bedrock",
    maxInputChars: 12000,
    maxOutputTokens: 2500,
    temperature: 0.2,
    costTrackingEnabled: false,
    auditStorePrompt: false,
    bedrock: { region: "us-east-1", modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0", providerMode: "converse", inputCostPer1MTokens: null, outputCostPer1MTokens: null },
  });
  assert.equal(router.name, "bedrock");
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadAnalysisProviderConfig } from "../dist/src/application/providers/analysis-provider-config.js";
import { ConfigurationError } from "../dist/src/index.js";

test("defaults to mock when AI_PROVIDER is not set", () => {
  const config = loadAnalysisProviderConfig({});
  assert.equal(config.provider, "mock");
});

test("returns mock config when AI_PROVIDER=mock", () => {
  const config = loadAnalysisProviderConfig({ AI_PROVIDER: "mock" });
  assert.equal(config.provider, "mock");
  assert.equal(config.openai, undefined);
  assert.equal(config.anthropic, undefined);
  assert.equal(config.bedrock, undefined);
});

test("throws ConfigurationError for unknown provider", () => {
  assert.throws(
    () => loadAnalysisProviderConfig({ AI_PROVIDER: "grok" }),
    (err) => err instanceof ConfigurationError && err.message.includes("not supported"),
  );
});

test("throws ConfigurationError for openai without API key", () => {
  assert.throws(
    () => loadAnalysisProviderConfig({ AI_PROVIDER: "openai" }),
    (err) => err instanceof ConfigurationError && err.message.includes("OPENAI_API_KEY"),
  );
});

test("returns openai config when key is provided", () => {
  const config = loadAnalysisProviderConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
  assert.equal(config.provider, "openai");
  assert.equal(config.openai?.apiKey, "sk-test");
  assert.equal(config.openai?.model, "gpt-4o-mini");
});

test("respects custom OPENAI_MODEL", () => {
  const config = loadAnalysisProviderConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-x", OPENAI_MODEL: "gpt-4o" });
  assert.equal(config.openai?.model, "gpt-4o");
});

test("throws ConfigurationError for anthropic without API key", () => {
  assert.throws(
    () => loadAnalysisProviderConfig({ AI_PROVIDER: "anthropic" }),
    (err) => err instanceof ConfigurationError && err.message.includes("ANTHROPIC_API_KEY"),
  );
});

test("returns anthropic config when key is provided", () => {
  const config = loadAnalysisProviderConfig({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-test" });
  assert.equal(config.provider, "anthropic");
  assert.equal(config.anthropic?.apiKey, "sk-ant-test");
  assert.equal(config.anthropic?.model, "claude-3-5-haiku-latest");
});

test("throws ConfigurationError for bedrock without model ID", () => {
  assert.throws(
    () => loadAnalysisProviderConfig({ AI_PROVIDER: "bedrock" }),
    (err) => err instanceof ConfigurationError && err.message.includes("BEDROCK_MODEL_ID"),
  );
});

test("returns bedrock config when model ID is provided", () => {
  const config = loadAnalysisProviderConfig({
    AI_PROVIDER: "bedrock",
    BEDROCK_MODEL_ID: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    AWS_REGION: "us-west-2",
  });
  assert.equal(config.provider, "bedrock");
  assert.equal(config.bedrock?.modelId, "anthropic.claude-3-5-sonnet-20241022-v2:0");
  assert.equal(config.bedrock?.region, "us-west-2");
});

test("applies generation defaults", () => {
  const config = loadAnalysisProviderConfig({});
  assert.equal(config.maxInputChars, 12000);
  assert.equal(config.maxOutputTokens, 2500);
  assert.equal(config.temperature, 0.2);
  assert.equal(config.costTrackingEnabled, true);
  assert.equal(config.auditStorePrompt, false);
});

test("allows overriding generation defaults", () => {
  const config = loadAnalysisProviderConfig({
    AI_MAX_INPUT_CHARS: "8000",
    AI_MAX_OUTPUT_TOKENS: "1000",
    AI_TEMPERATURE: "0.5",
    AI_COST_TRACKING_ENABLED: "false",
    AI_AUDIT_STORE_PROMPT: "true",
  });
  assert.equal(config.maxInputChars, 8000);
  assert.equal(config.maxOutputTokens, 1000);
  assert.equal(config.temperature, 0.5);
  assert.equal(config.costTrackingEnabled, false);
  assert.equal(config.auditStorePrompt, true);
});

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
  assert.equal(config.openai?.model, "gpt-5.5");
});

test("treats blank AI_PROVIDER the same as unset (defaults to mock)", () => {
  const config = loadAnalysisProviderConfig({ AI_PROVIDER: "" });
  assert.equal(config.provider, "mock");
});

test("treats blank OPENAI_MODEL/OPENAI_TASKS_MODEL as unset and falls back to default", () => {
  const config = loadAnalysisProviderConfig({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    OPENAI_MODEL: "  ",
    OPENAI_TASKS_MODEL: "",
  });
  assert.equal(config.openai?.model, "gpt-5.5");
});

test("respects custom OPENAI_MODEL", () => {
  const config = loadAnalysisProviderConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-x", OPENAI_MODEL: "gpt-4o" });
  assert.equal(config.openai?.model, "gpt-4o");
});

test("OPENAI_TASKS_MODEL overrides OPENAI_MODEL for lighter-weight tasks", () => {
  const config = loadAnalysisProviderConfig({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-x",
    OPENAI_MODEL: "gpt-5.5",
    OPENAI_TASKS_MODEL: "gpt-5.4-mini",
  });
  assert.equal(config.openai?.model, "gpt-5.4-mini");
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

test("throws ConfigurationError for bedrock with blank model ID", () => {
  assert.throws(
    () => loadAnalysisProviderConfig({ AI_PROVIDER: "bedrock", BEDROCK_MODEL_ID: "   " }),
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
  assert.equal(config.maxOutputTokens, 2500);
  assert.equal(config.temperature, 0.2);
});

test("allows overriding generation defaults", () => {
  const config = loadAnalysisProviderConfig({
    AI_MAX_OUTPUT_TOKENS: "1000",
    AI_TEMPERATURE: "0.5",
  });
  assert.equal(config.maxOutputTokens, 1000);
  assert.equal(config.temperature, 0.5);
});

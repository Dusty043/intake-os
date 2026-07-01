/**
 * TASK-0029: Rate Limiting
 * Tests: loadRateLimitConfig() defaults and env-var overrides
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// We import the compiled config from the api build output
const { loadRateLimitConfig } = await import("../dist/apps/api/src/config/rate-limit.config.js");

// ---------------------------------------------------------------------------
// Default config values
// ---------------------------------------------------------------------------

describe("loadRateLimitConfig — defaults", () => {
  // Ensure no env vars are set that could contaminate these tests
  const RL_KEYS = [
    "RATE_LIMIT_GLOBAL_TTL", "RATE_LIMIT_GLOBAL_LIMIT",
    "RATE_LIMIT_INTAKE_TTL", "RATE_LIMIT_INTAKE_LIMIT",
    "RATE_LIMIT_AI_TTL", "RATE_LIMIT_AI_LIMIT",
    "RATE_LIMIT_REGEN_TTL", "RATE_LIMIT_REGEN_LIMIT",
    "RATE_LIMIT_MOCK_TTL", "RATE_LIMIT_MOCK_LIMIT",
    "RATE_LIMIT_WEBHOOK_TTL", "RATE_LIMIT_WEBHOOK_LIMIT",
  ];
  let saved = {};

  beforeEach(() => {
    saved = {};
    for (const k of RL_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of RL_KEYS) {
      if (saved[k] !== undefined) {
        process.env[k] = saved[k];
      } else {
        delete process.env[k];
      }
    }
  });

  test("global default is 60 req per 60s", () => {
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.global.ttl, 60);
    assert.equal(cfg.global.limit, 60);
  });

  test("intakeSubmit default is 10 req per 60s", () => {
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.intakeSubmit.ttl, 60);
    assert.equal(cfg.intakeSubmit.limit, 10);
  });

  test("aiEvaluation default is 5 req per 60s", () => {
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.aiEvaluation.ttl, 60);
    assert.equal(cfg.aiEvaluation.limit, 5);
  });

  test("draftRegeneration default is 5 req per 60s", () => {
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.draftRegeneration.ttl, 60);
    assert.equal(cfg.draftRegeneration.limit, 5);
  });

  test("mockDraft default is 10 req per 60s", () => {
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.mockDraft.ttl, 60);
    assert.equal(cfg.mockDraft.limit, 10);
  });

  test("inboundWebhook default is 100 req per 60s", () => {
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.inboundWebhook.ttl, 60);
    assert.equal(cfg.inboundWebhook.limit, 100);
  });

  test("intakeSubmit limit is strictly lower than global limit", () => {
    const cfg = loadRateLimitConfig();
    assert.ok(
      cfg.intakeSubmit.limit < cfg.global.limit,
      `intakeSubmit.limit (${cfg.intakeSubmit.limit}) should be < global.limit (${cfg.global.limit})`,
    );
  });

  test("aiEvaluation limit is stricter than intakeSubmit limit", () => {
    const cfg = loadRateLimitConfig();
    assert.ok(
      cfg.aiEvaluation.limit < cfg.intakeSubmit.limit,
      `aiEvaluation.limit (${cfg.aiEvaluation.limit}) should be < intakeSubmit.limit (${cfg.intakeSubmit.limit})`,
    );
  });
});

// ---------------------------------------------------------------------------
// Env-var overrides
// ---------------------------------------------------------------------------

describe("loadRateLimitConfig — env-var overrides", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_GLOBAL_TTL;
    delete process.env.RATE_LIMIT_GLOBAL_LIMIT;
    delete process.env.RATE_LIMIT_INTAKE_TTL;
    delete process.env.RATE_LIMIT_INTAKE_LIMIT;
    delete process.env.RATE_LIMIT_AI_TTL;
    delete process.env.RATE_LIMIT_AI_LIMIT;
    delete process.env.RATE_LIMIT_REGEN_TTL;
    delete process.env.RATE_LIMIT_REGEN_LIMIT;
    delete process.env.RATE_LIMIT_MOCK_TTL;
    delete process.env.RATE_LIMIT_MOCK_LIMIT;
    delete process.env.RATE_LIMIT_WEBHOOK_TTL;
    delete process.env.RATE_LIMIT_WEBHOOK_LIMIT;
  });

  test("RATE_LIMIT_GLOBAL_LIMIT overrides global limit", () => {
    process.env.RATE_LIMIT_GLOBAL_LIMIT = "120";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.global.limit, 120);
  });

  test("RATE_LIMIT_GLOBAL_TTL overrides global ttl", () => {
    process.env.RATE_LIMIT_GLOBAL_TTL = "30";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.global.ttl, 30);
  });

  test("RATE_LIMIT_INTAKE_LIMIT overrides intakeSubmit limit", () => {
    process.env.RATE_LIMIT_INTAKE_LIMIT = "20";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.intakeSubmit.limit, 20);
  });

  test("RATE_LIMIT_AI_LIMIT overrides aiEvaluation limit", () => {
    process.env.RATE_LIMIT_AI_LIMIT = "3";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.aiEvaluation.limit, 3);
  });

  test("RATE_LIMIT_REGEN_LIMIT overrides draftRegeneration limit", () => {
    process.env.RATE_LIMIT_REGEN_LIMIT = "2";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.draftRegeneration.limit, 2);
  });

  test("RATE_LIMIT_WEBHOOK_LIMIT overrides inboundWebhook limit", () => {
    process.env.RATE_LIMIT_WEBHOOK_LIMIT = "200";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.inboundWebhook.limit, 200);
  });

  test("multiple overrides applied simultaneously", () => {
    process.env.RATE_LIMIT_GLOBAL_LIMIT = "30";
    process.env.RATE_LIMIT_INTAKE_LIMIT = "5";
    process.env.RATE_LIMIT_AI_LIMIT = "1";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.global.limit, 30);
    assert.equal(cfg.intakeSubmit.limit, 5);
    assert.equal(cfg.aiEvaluation.limit, 1);
  });
});

// ---------------------------------------------------------------------------
// TASK-0040: invalid values fall back to the default instead of reaching
// ThrottlerModule as NaN/0/negative
// ---------------------------------------------------------------------------

describe("loadRateLimitConfig — invalid values fall back to defaults", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_GLOBAL_LIMIT;
    delete process.env.RATE_LIMIT_GLOBAL_TTL;
    delete process.env.RATE_LIMIT_AI_LIMIT;
  });

  test("non-numeric value falls back to default", () => {
    process.env.RATE_LIMIT_GLOBAL_LIMIT = "not-a-number";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.global.limit, 60);
  });

  test("zero falls back to default", () => {
    process.env.RATE_LIMIT_GLOBAL_TTL = "0";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.global.ttl, 60);
  });

  test("negative value falls back to default", () => {
    process.env.RATE_LIMIT_AI_LIMIT = "-5";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.aiEvaluation.limit, 5);
  });

  test("empty string is treated as unset (falls back to default, not NaN)", () => {
    process.env.RATE_LIMIT_GLOBAL_LIMIT = "";
    const cfg = loadRateLimitConfig();
    assert.equal(cfg.global.limit, 60);
  });
});

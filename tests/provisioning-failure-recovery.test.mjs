/**
 * TASK-0028: Failure & Recovery
 * Tests: error categorization, auto-retry backoff logic, dead-letter ceiling, mark-resolved
 */

import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProvisioningError,
  isAutoRetryable,
  calculateBackoffMs,
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
} from "../dist/src/index.js";

// ---------------------------------------------------------------------------
// normalizeProvisioningError
// ---------------------------------------------------------------------------

describe("normalizeProvisioningError", () => {
  test("classifies 429 as rate_limit", () => {
    const r = normalizeProvisioningError("HTTP 429 Too Many Requests");
    assert.equal(r.category, "rate_limit");
    assert.equal(r.retryable, true);
  });

  test("classifies 'rate limit exceeded' as rate_limit", () => {
    const r = normalizeProvisioningError("rate limit exceeded");
    assert.equal(r.category, "rate_limit");
  });

  test("classifies 401 as auth_error", () => {
    const r = normalizeProvisioningError("HTTP 401 Unauthorized");
    assert.equal(r.category, "auth_error");
    assert.equal(r.retryable, false);
  });

  test("classifies 403 as auth_error", () => {
    const r = normalizeProvisioningError("403 Forbidden");
    assert.equal(r.category, "auth_error");
  });

  test("classifies 'unauthorized' keyword as auth_error", () => {
    const r = normalizeProvisioningError("unauthorized access to resource");
    assert.equal(r.category, "auth_error");
  });

  test("classifies 400 as validation_error", () => {
    const r = normalizeProvisioningError("HTTP 400 Bad Request");
    assert.equal(r.category, "validation_error");
    assert.equal(r.retryable, false);
  });

  test("classifies 'already exists' as collision", () => {
    const r = normalizeProvisioningError("Resource already exists");
    assert.equal(r.category, "collision");
    assert.equal(r.retryable, false);
  });

  test("classifies 409 conflict as collision", () => {
    const r = normalizeProvisioningError("409 Conflict");
    assert.equal(r.category, "collision");
  });

  test("classifies 500 as transient_api_error", () => {
    const r = normalizeProvisioningError("HTTP 500 Internal Server Error");
    assert.equal(r.category, "transient_api_error");
    assert.equal(r.retryable, true);
  });

  test("classifies 'network timeout' as transient_api_error", () => {
    const r = normalizeProvisioningError("network timeout");
    assert.equal(r.category, "transient_api_error");
    assert.equal(r.retryable, true);
  });

  test("classifies 'ECONNRESET' as transient_api_error", () => {
    const r = normalizeProvisioningError("ECONNRESET");
    assert.equal(r.category, "transient_api_error");
  });

  test("classifies 'missing config' as config_error", () => {
    const r = normalizeProvisioningError("missing config value");
    assert.equal(r.category, "config_error");
    assert.equal(r.retryable, false);
  });

  test("classifies unknown errors as unknown", () => {
    const r = normalizeProvisioningError("something went completely sideways");
    assert.equal(r.category, "unknown");
    assert.equal(r.retryable, false);
  });

  test("accepts Error objects", () => {
    const r = normalizeProvisioningError(new Error("rate limit hit"));
    assert.equal(r.category, "rate_limit");
  });
});

// ---------------------------------------------------------------------------
// isAutoRetryable
// ---------------------------------------------------------------------------

describe("isAutoRetryable", () => {
  test("transient_api_error is auto-retryable", () => {
    assert.equal(isAutoRetryable("transient_api_error"), true);
  });

  test("rate_limit is auto-retryable", () => {
    assert.equal(isAutoRetryable("rate_limit"), true);
  });

  test("auth_error is NOT auto-retryable", () => {
    assert.equal(isAutoRetryable("auth_error"), false);
  });

  test("validation_error is NOT auto-retryable", () => {
    assert.equal(isAutoRetryable("validation_error"), false);
  });

  test("collision is NOT auto-retryable", () => {
    assert.equal(isAutoRetryable("collision"), false);
  });

  test("config_error is NOT auto-retryable", () => {
    assert.equal(isAutoRetryable("config_error"), false);
  });

  test("unknown is NOT auto-retryable", () => {
    assert.equal(isAutoRetryable("unknown"), false);
  });
});

// ---------------------------------------------------------------------------
// calculateBackoffMs
// ---------------------------------------------------------------------------

describe("calculateBackoffMs", () => {
  test("first attempt returns ~base delay (1000ms default)", () => {
    const ms = calculateBackoffMs(1, { jitterFactor: 0 });
    assert.equal(ms, 1000);
  });

  test("second attempt doubles base", () => {
    const ms = calculateBackoffMs(2, { jitterFactor: 0 });
    assert.equal(ms, 2000);
  });

  test("third attempt is 4x base", () => {
    const ms = calculateBackoffMs(3, { jitterFactor: 0 });
    assert.equal(ms, 4000);
  });

  test("respects maxDelayMs cap", () => {
    const ms = calculateBackoffMs(10, { baseDelayMs: 1000, maxDelayMs: 5000, jitterFactor: 0 });
    assert.equal(ms, 5000);
  });

  test("jitter produces values within expected range", () => {
    for (let i = 0; i < 20; i++) {
      const ms = calculateBackoffMs(1, { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0.2 });
      assert.ok(ms >= 800 && ms <= 1200, `ms=${ms} not in [800,1200]`);
    }
  });

  test("custom base delay is respected", () => {
    const ms = calculateBackoffMs(1, { baseDelayMs: 500, jitterFactor: 0 });
    assert.equal(ms, 500);
  });

  test("result is never negative", () => {
    const ms = calculateBackoffMs(1, { baseDelayMs: 0, jitterFactor: 1 });
    assert.ok(ms >= 0);
  });
});

// ---------------------------------------------------------------------------
// InMemoryProjectIntakeStore.updateProvisioningTargetResult
// ---------------------------------------------------------------------------

describe("updateProvisioningTargetResult", () => {
  function makeRun(targetId) {
    return {
      id: "run-1",
      intakeId: "intake-1",
      planId: "plan-1",
      status: "failed",
      kind: "initial",
      triggeredById: "u1",
      triggeredByRole: "devops",
      startedAt: new Date().toISOString(),
      targets: [
        {
          id: targetId,
          runId: "run-1",
          targetKind: "monday_project_item",
          status: "failed",
          idempotencyKey: `ikey-${targetId}`,
          errorMessage: "API error",
          errorCategory: undefined,
          attemptCount: 1,
          retryable: true,
          deadLettered: false,
        },
      ],
    };
  }

  test("updates target fields in memory", async () => {
    const store = new InMemoryProjectIntakeStore();
    await store.saveProvisioningRun(makeRun("t-001"));

    await store.updateProvisioningTargetResult("t-001", {
      deadLettered: true,
      retryable: false,
      errorCategory: "auth_error",
    });

    const runs = await store.listProvisioningRuns("intake-1");
    const target = runs[0].targets[0];
    assert.equal(target.deadLettered, true);
    assert.equal(target.retryable, false);
    assert.equal(target.errorCategory, "auth_error");
  });

  test("silently succeeds when target not found", async () => {
    const store = new InMemoryProjectIntakeStore();
    await assert.doesNotReject(() =>
      store.updateProvisioningTargetResult("nonexistent", { deadLettered: true }),
    );
  });
});

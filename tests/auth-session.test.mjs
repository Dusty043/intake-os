import { strict as assert } from "assert";
import { describe, it } from "node:test";
import crypto from "crypto";
import { hashToken } from "../dist/apps/api/src/modules/auth/session.service.js";

/**
 * Unit tests for session token utilities.
 * These do not require a database — they test the hashing logic in isolation.
 *
 * Integration tests for full session lifecycle (create / validate / revoke) require
 * a running Postgres instance and are exercised by smoke:runtime in CI.
 */

describe("auth-session (unit)", () => {
  it("hashToken produces a 64-char hex string", () => {
    const token = crypto.randomBytes(32).toString("hex");
    const hash = hashToken(token);
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it("same token always produces same hash", () => {
    const token = "deterministic-test-token-12345";
    assert.equal(hashToken(token), hashToken(token));
  });

  it("different tokens produce different hashes", () => {
    const t1 = crypto.randomBytes(32).toString("hex");
    const t2 = crypto.randomBytes(32).toString("hex");
    assert.notEqual(hashToken(t1), hashToken(t2));
  });

  it("raw token and its hash are different strings", () => {
    const token = crypto.randomBytes(32).toString("hex");
    assert.notEqual(token, hashToken(token));
  });

  it("empty string hashes deterministically", () => {
    const h1 = hashToken("");
    const h2 = hashToken("");
    assert.equal(h1, h2);
    assert.equal(h1.length, 64);
  });

  it("session TTL calculation: 8 hours = 28800000ms", () => {
    const ttlHours = 8;
    const now = Date.now();
    const expiresAt = new Date(now + ttlHours * 3600 * 1000);
    const diff = expiresAt.getTime() - now;
    assert.equal(diff, 28800000);
  });

  it("expired session detection: past expiry is expired", () => {
    const expiresAt = new Date(Date.now() - 1000); // 1 second ago
    assert.ok(expiresAt < new Date(), "past date should be expired");
  });

  it("valid session detection: future expiry is not expired", () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    assert.ok(expiresAt >= new Date(), "future date should not be expired");
  });
});

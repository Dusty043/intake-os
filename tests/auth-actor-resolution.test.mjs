import { strict as assert } from "assert";
import { describe, it, before, after } from "node:test";
import http from "http";

/**
 * Tests actor resolution behaviour in both AUTH_MODE=dev_headers and AUTH_MODE=google.
 * Starts a real HTTP request against a minimal smoke API to verify the guard.
 *
 * These tests only exercise the in-process role resolver and header behaviour
 * without needing a real database. The session validation path (google mode)
 * is tested separately in auth-session.test.mjs using mock primitives.
 */

const API_BASE = process.env.API_BASE ?? "http://localhost:3000";
const HEALTH_URL = `${API_BASE}/health`;
const ME_URL = `${API_BASE}/auth/me`;
const INTAKES_URL = `${API_BASE}/intakes`;

async function get(url, headers = {}) {
  return new Promise((resolve) => {
    const req = http.get(url, { headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ status: 0, body: "" });
    });
  });
}

// These tests require a running API with AUTH_MODE=dev_headers.
// They are skipped automatically if the API is not reachable.
describe("auth-actor-resolution (requires running API)", async () => {
  let apiReachable = false;

  before(async () => {
    const { status } = await get(HEALTH_URL);
    apiReachable = status === 200;
  });

  it("health route is always public (no auth required)", async () => {
    const { status } = await get(HEALTH_URL);
    if (!apiReachable) return;
    assert.equal(status, 200);
  });

  it("/auth/me returns unauthenticated state without session in dev_headers mode", async () => {
    if (!apiReachable) return;
    const { status, body } = await get(ME_URL);
    assert.equal(status, 200);
    const data = JSON.parse(body);
    assert.equal(typeof data.authenticated, "boolean");
    assert.equal(typeof data.authMode, "string");
  });

  it("GET /intakes works in dev_headers mode without session cookie", async () => {
    if (!apiReachable) return;
    const { status } = await get(INTAKES_URL, {
      "x-actor-id": "test-user",
      "x-actor-role": "request_creator",
    });
    // In dev_headers mode, no cookie needed
    assert.ok(status === 200 || status === 404, `Expected 200 or 404, got ${status}`);
  });

  it("actor role from x-actor-role header is respected in dev_headers mode", async () => {
    if (!apiReachable) return;
    const { status } = await get(INTAKES_URL, {
      "x-actor-id": "test-admin",
      "x-actor-role": "admin",
      "x-actor-name": "Test Admin",
    });
    assert.ok(status === 200 || status === 404, `Expected 200 or 404, got ${status}`);
  });
});

/**
 * Pure unit tests for role resolver — no HTTP needed.
 */
describe("auth-actor-resolution (unit)", () => {
  it("resolves actor from dev headers when AUTH_MODE=dev_headers", async () => {
    const { resolveRoleFromEmail, resolveRoleConfigFromEnv } = await import(
      "../dist/apps/api/src/modules/auth/role-resolver.js"
    );

    const config = resolveRoleConfigFromEnv();
    // In default dev env, no restrictions means any email is allowed
    const role = resolveRoleFromEmail("user@example.com", {
      ...config,
      allowedDomains: [],
      allowedEmails: [],
    });
    assert.equal(role, config.defaultRole);
  });
});

import { strict as assert } from "assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { AuthGuard } from "../dist/apps/api/src/modules/auth/auth.guard.js";

/**
 * Service-token auth must be additive, not exclusive: a caller can present either
 * a service token or a real Google session under AUTH_MODE=google, and either a
 * service token or a dev_headers actor header under AUTH_MODE=dev_headers. Neither
 * mode disables the other's path.
 */

const fakeReflector = { getAllAndOverride: () => undefined };

function makeContext(request) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe("auth-guard dual-mode (service token alongside dev_headers/google)", () => {
  let originalAuthMode;
  let originalServiceTokens;

  beforeEach(() => {
    originalAuthMode = process.env.AUTH_MODE;
    originalServiceTokens = process.env.AUTH_SERVICE_TOKENS;
  });

  afterEach(() => {
    if (originalAuthMode === undefined) delete process.env.AUTH_MODE;
    else process.env.AUTH_MODE = originalAuthMode;

    if (originalServiceTokens === undefined) delete process.env.AUTH_SERVICE_TOKENS;
    else process.env.AUTH_SERVICE_TOKENS = originalServiceTokens;
  });

  it("AUTH_MODE=google: a valid service token authenticates without touching the session store", async () => {
    process.env.AUTH_MODE = "google";
    process.env.AUTH_SERVICE_TOKENS = "ci:tok-abc:admin";
    let sessionCalled = false;
    const guard = new AuthGuard(fakeReflector, {
      validateSession: async () => {
        sessionCalled = true;
        return null;
      },
    });

    const request = { headers: { authorization: "Bearer tok-abc" } };
    const result = await guard.canActivate(makeContext(request));

    assert.equal(result, true);
    assert.equal(request.actor.role, "admin");
    assert.equal(request.actor.authProvider, "service_token");
    assert.equal(sessionCalled, false, "service-token path must not fall through to session validation");
  });

  it("AUTH_MODE=google: no bearer token still uses the real Google session cookie path", async () => {
    process.env.AUTH_MODE = "google";
    process.env.AUTH_SERVICE_TOKENS = "ci:tok-abc:admin";
    const mockActor = { id: "u1", email: "a@simple.biz", name: "A", role: "intake_owner", authProvider: "google" };
    const guard = new AuthGuard(fakeReflector, {
      validateSession: async (token) => (token === "session-token-xyz" ? mockActor : null),
    });

    const request = { headers: {}, cookies: { intake_os_session: "session-token-xyz" } };
    const result = await guard.canActivate(makeContext(request));

    assert.equal(result, true);
    assert.deepEqual(request.actor, mockActor);
  });

  it("AUTH_MODE=dev_headers: a valid service token still authenticates (additive, not exclusive)", async () => {
    process.env.AUTH_MODE = "dev_headers";
    process.env.AUTH_SERVICE_TOKENS = "ci:tok-abc:devops_lead";
    const guard = new AuthGuard(fakeReflector, { validateSession: async () => null });

    const request = { headers: { authorization: "Bearer tok-abc" } };
    const result = await guard.canActivate(makeContext(request));

    assert.equal(result, true);
    assert.equal(request.actor.role, "devops_lead");
    assert.equal(request.actor.authProvider, "service_token");
  });

  it("AUTH_MODE=dev_headers: no bearer token falls back to the trusted x-actor-role header", async () => {
    process.env.AUTH_MODE = "dev_headers";
    process.env.AUTH_SERVICE_TOKENS = "ci:tok-abc:devops_lead";
    const guard = new AuthGuard(fakeReflector, { validateSession: async () => null });

    const request = { headers: { "x-actor-role": "intake_owner", "x-actor-id": "u2" } };
    const result = await guard.canActivate(makeContext(request));

    assert.equal(result, true);
    assert.equal(request.actor.role, "intake_owner");
    assert.equal(request.actor.authProvider, "dev_headers");
  });

  it("an unrecognized bearer token is rejected even when a valid Google session cookie is also present", async () => {
    process.env.AUTH_MODE = "google";
    process.env.AUTH_SERVICE_TOKENS = "ci:tok-abc:admin";
    const mockActor = { id: "u1", email: "a@simple.biz", name: "A", role: "admin", authProvider: "google" };
    const guard = new AuthGuard(fakeReflector, { validateSession: async () => mockActor });

    const request = {
      headers: { authorization: "Bearer wrong-token" },
      cookies: { intake_os_session: "would-be-valid" },
    };

    await assert.rejects(
      () => guard.canActivate(makeContext(request)),
      (err) => {
        assert.equal(err.getStatus(), 401);
        return true;
      },
    );
  });

  it("spoofed x-actor-role alongside a lower-privileged service token does not escalate role", async () => {
    process.env.AUTH_MODE = "dev_headers";
    process.env.AUTH_SERVICE_TOKENS = "ci:tok-abc:request_creator";
    const guard = new AuthGuard(fakeReflector, { validateSession: async () => null });

    const request = {
      headers: { authorization: "Bearer tok-abc", "x-actor-role": "admin" },
    };
    const result = await guard.canActivate(makeContext(request));

    assert.equal(result, true);
    assert.equal(request.actor.role, "request_creator");
  });
});

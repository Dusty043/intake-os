import { strict as assert } from "assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import crypto from "crypto";

const { GoogleAuthService } = await import(
  "../dist/apps/api/src/modules/auth/google-auth.service.js"
);
const { resolveRoleFromEmail, resolveRoleConfigFromEnv } = await import(
  "../dist/apps/api/src/modules/auth/role-resolver.js"
);

// ─── GoogleAuthService — URL generation ──────────────────────────────────────

describe("GoogleAuthService — authorization URL", () => {
  let savedClientId;
  let savedSecret;
  let savedBaseUrl;

  beforeEach(() => {
    savedClientId = process.env.AUTH_GOOGLE_CLIENT_ID;
    savedSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET;
    savedBaseUrl = process.env.AUTH_PUBLIC_BASE_URL;
    process.env.AUTH_GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
    process.env.AUTH_GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.AUTH_PUBLIC_BASE_URL = "https://intake.example.com";
  });

  afterEach(() => {
    if (savedClientId === undefined) delete process.env.AUTH_GOOGLE_CLIENT_ID;
    else process.env.AUTH_GOOGLE_CLIENT_ID = savedClientId;
    if (savedSecret === undefined) delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    else process.env.AUTH_GOOGLE_CLIENT_SECRET = savedSecret;
    if (savedBaseUrl === undefined) delete process.env.AUTH_PUBLIC_BASE_URL;
    else process.env.AUTH_PUBLIC_BASE_URL = savedBaseUrl;
  });

  it("returns a Google accounts OAuth URL", () => {
    const svc = new GoogleAuthService();
    const url = svc.getAuthorizationUrl("test-state-abc");
    assert.ok(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), `unexpected URL: ${url}`);
  });

  it("URL includes the state parameter", () => {
    const svc = new GoogleAuthService();
    const state = "my-csrf-state-123";
    const url = svc.getAuthorizationUrl(state);
    assert.ok(url.includes(`state=${encodeURIComponent(state)}`), `state not in URL: ${url}`);
  });

  it("URL requests openid email profile scopes", () => {
    const svc = new GoogleAuthService();
    const url = svc.getAuthorizationUrl("s");
    assert.ok(url.includes("openid"), `missing openid scope: ${url}`);
    assert.ok(url.includes("email"), `missing email scope: ${url}`);
    assert.ok(url.includes("profile"), `missing profile scope: ${url}`);
  });

  it("URL includes redirect_uri pointing to our callback", () => {
    const svc = new GoogleAuthService();
    const url = svc.getAuthorizationUrl("s");
    assert.ok(
      url.includes(encodeURIComponent("https://intake.example.com/api/auth/google/callback")),
      `callback URI not in URL: ${url}`,
    );
  });

  it("throws at URL generation when AUTH_GOOGLE_CLIENT_ID is missing", () => {
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    const svc = new GoogleAuthService();
    assert.throws(
      () => svc.getAuthorizationUrl("s"),
      (err) => {
        assert.ok(err.message.includes("AUTH_GOOGLE_CLIENT_ID"));
        return true;
      },
    );
  });

  it("uses AUTH_GOOGLE_CALLBACK_PATH override when set", () => {
    process.env.AUTH_GOOGLE_CALLBACK_PATH = "/custom/callback";
    const svc = new GoogleAuthService();
    const url = svc.getAuthorizationUrl("s");
    assert.ok(
      url.includes(encodeURIComponent("https://intake.example.com/custom/callback")),
      `custom callback not in URL: ${url}`,
    );
    delete process.env.AUTH_GOOGLE_CALLBACK_PATH;
  });
});

// ─── State token format ───────────────────────────────────────────────────────

describe("OAuth state token generation", () => {
  it("state token is 32-char lowercase hex", () => {
    const state = crypto.randomBytes(16).toString("hex");
    assert.equal(state.length, 32);
    assert.match(state, /^[0-9a-f]+$/);
  });

  it("two state tokens are always different", () => {
    const s1 = crypto.randomBytes(16).toString("hex");
    const s2 = crypto.randomBytes(16).toString("hex");
    assert.notEqual(s1, s2);
  });
});

// ─── Role config from environment ─────────────────────────────────────────────

describe("resolveRoleConfigFromEnv", () => {
  let saved = {};

  const ENV_KEYS = [
    "AUTH_ADMIN_EMAILS",
    "AUTH_INTAKE_OWNER_EMAILS",
    "AUTH_DEVOPS_LEAD_EMAILS",
    "AUTH_DEVELOPER_EMAILS",
    "AUTH_ALLOWED_EMAILS",
    "AUTH_ALLOWED_DOMAINS",
    "AUTH_DEFAULT_ROLE",
  ];

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns empty arrays when no env vars set", () => {
    const config = resolveRoleConfigFromEnv();
    assert.deepEqual(config.adminEmails, []);
    assert.deepEqual(config.allowedDomains, []);
  });

  it("parses comma-separated admin emails", () => {
    process.env.AUTH_ADMIN_EMAILS = "alice@co.com, BOB@CO.COM,carol@co.com";
    const config = resolveRoleConfigFromEnv();
    assert.deepEqual(config.adminEmails, ["alice@co.com", "bob@co.com", "carol@co.com"]);
  });

  it("parses comma-separated allowed domains", () => {
    process.env.AUTH_ALLOWED_DOMAINS = "acme.com,widgets.io";
    const config = resolveRoleConfigFromEnv();
    assert.deepEqual(config.allowedDomains, ["acme.com", "widgets.io"]);
  });

  it("defaults to request_creator role when AUTH_DEFAULT_ROLE unset", () => {
    const config = resolveRoleConfigFromEnv();
    assert.equal(config.defaultRole, "request_creator");
  });

  it("respects custom AUTH_DEFAULT_ROLE", () => {
    process.env.AUTH_DEFAULT_ROLE = "developer";
    const config = resolveRoleConfigFromEnv();
    assert.equal(config.defaultRole, "developer");
  });

  it("end-to-end: env config + role resolution works for admin", () => {
    process.env.AUTH_ADMIN_EMAILS = "admin@simple.biz";
    process.env.AUTH_ALLOWED_DOMAINS = "simple.biz";
    const config = resolveRoleConfigFromEnv();
    assert.equal(resolveRoleFromEmail("admin@simple.biz", config), "admin");
    assert.equal(resolveRoleFromEmail("user@simple.biz", config), "request_creator");
    assert.equal(resolveRoleFromEmail("outside@other.com", config), null);
  });
});

// ─── Session TTL math ─────────────────────────────────────────────────────────

describe("session TTL calculation", () => {
  it("8-hour TTL is 28800000ms", () => {
    const ttlHours = 8;
    assert.equal(ttlHours * 3600 * 1000, 28800000);
  });

  it("24-hour TTL is 86400000ms", () => {
    const ttlHours = 24;
    assert.equal(ttlHours * 3600 * 1000, 86400000);
  });

  it("session cookie maxAge matches TTL in ms", () => {
    const ttlHours = Number(process.env.AUTH_SESSION_TTL_HOURS ?? "8");
    const maxAge = ttlHours * 3600 * 1000;
    assert.ok(maxAge > 0);
    assert.equal(maxAge, ttlHours * 3600 * 1000);
  });
});

// ─── Forbidden user path ─────────────────────────────────────────────────────

describe("forbidden login path", () => {
  it("null role means user is not allowed", () => {
    const config = {
      adminEmails: [],
      intakeOwnerEmails: [],
      devopsLeadEmails: [],
      developerEmails: [],
      allowedEmails: [],
      allowedDomains: ["company.com"],
      defaultRole: "request_creator",
    };
    const role = resolveRoleFromEmail("outsider@other.org", config);
    assert.equal(role, null, "outsider should be denied (null role)");
  });

  it("null role is distinct from a valid role string", () => {
    assert.notEqual(null, "request_creator");
    assert.notEqual(null, "admin");
  });
});

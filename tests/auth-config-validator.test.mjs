import { strict as assert } from "assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { validateAuthConfig } from "../dist/src/index.js";

describe("auth-config-validator", () => {
  let originalAuthMode;
  let originalNodeEnv;
  let originalClientId;
  let originalSessionCookieName;

  beforeEach(() => {
    originalAuthMode = process.env.AUTH_MODE;
    originalNodeEnv = process.env.NODE_ENV;
    originalClientId = process.env.AUTH_GOOGLE_CLIENT_ID;
    originalSessionCookieName = process.env.AUTH_SESSION_COOKIE_NAME;
  });

  afterEach(() => {
    if (originalAuthMode === undefined) {
      delete process.env.AUTH_MODE;
    } else {
      process.env.AUTH_MODE = originalAuthMode;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalClientId === undefined) {
      delete process.env.AUTH_GOOGLE_CLIENT_ID;
    } else {
      process.env.AUTH_GOOGLE_CLIENT_ID = originalClientId;
    }
    if (originalSessionCookieName === undefined) {
      delete process.env.AUTH_SESSION_COOKIE_NAME;
    } else {
      process.env.AUTH_SESSION_COOKIE_NAME = originalSessionCookieName;
    }
  });

  describe("development (NODE_ENV unset or development)", () => {
    it("defaults to dev_headers when AUTH_MODE is not set", () => {
      delete process.env.AUTH_MODE;
      delete process.env.NODE_ENV;
      const config = validateAuthConfig();
      assert.equal(config.mode, "dev_headers");
    });

    it("accepts explicit dev_headers in development", () => {
      process.env.AUTH_MODE = "dev_headers";
      process.env.NODE_ENV = "development";
      const config = validateAuthConfig();
      assert.equal(config.mode, "dev_headers");
    });

    it("accepts google in development", () => {
      process.env.AUTH_MODE = "google";
      process.env.NODE_ENV = "development";
      process.env.AUTH_GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
      process.env.AUTH_SESSION_COOKIE_NAME = "test_session_cookie";
      const config = validateAuthConfig();
      assert.equal(config.mode, "google");
    });

    it("throws when AUTH_MODE=google without AUTH_GOOGLE_CLIENT_ID", () => {
      process.env.AUTH_MODE = "google";
      process.env.NODE_ENV = "development";
      delete process.env.AUTH_GOOGLE_CLIENT_ID;
      process.env.AUTH_SESSION_COOKIE_NAME = "test_session_cookie";
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("AUTH_GOOGLE_CLIENT_ID"));
          return true;
        },
      );
    });

    it("throws when AUTH_MODE=google without AUTH_SESSION_COOKIE_NAME", () => {
      process.env.AUTH_MODE = "google";
      process.env.NODE_ENV = "development";
      process.env.AUTH_GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
      delete process.env.AUTH_SESSION_COOKIE_NAME;
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("AUTH_SESSION_COOKIE_NAME"));
          return true;
        },
      );
    });

    it("rejects unknown auth mode in development", () => {
      process.env.AUTH_MODE = "magic_auth";
      process.env.NODE_ENV = "development";
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("Invalid AUTH_MODE"));
          assert.ok(err.message.includes("magic_auth"));
          return true;
        },
      );
    });
  });

  describe("production (NODE_ENV=production)", () => {
    it("throws when AUTH_MODE is not set in production", () => {
      delete process.env.AUTH_MODE;
      process.env.NODE_ENV = "production";
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("AUTH_MODE is not set"));
          assert.ok(err.message.includes("production"));
          return true;
        },
      );
    });

    it("throws when AUTH_MODE=dev_headers in production", () => {
      process.env.AUTH_MODE = "dev_headers";
      process.env.NODE_ENV = "production";
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("dev_headers"));
          assert.ok(err.message.includes("not permitted in production"));
          return true;
        },
      );
    });

    it("accepts google in production", () => {
      process.env.AUTH_MODE = "google";
      process.env.NODE_ENV = "production";
      process.env.AUTH_GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
      process.env.AUTH_SESSION_COOKIE_NAME = "test_session_cookie";
      const config = validateAuthConfig();
      assert.equal(config.mode, "google");
    });

    it("rejects unknown auth mode in production", () => {
      process.env.AUTH_MODE = "ldap";
      process.env.NODE_ENV = "production";
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("Invalid AUTH_MODE"));
          assert.ok(err.message.includes("ldap"));
          return true;
        },
      );
    });
  });

  describe("error messages are actionable", () => {
    it("missing AUTH_MODE error mentions AUTH_MODE=google as fix", () => {
      delete process.env.AUTH_MODE;
      process.env.NODE_ENV = "production";
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("AUTH_MODE=google"));
          return true;
        },
      );
    });

    it("dev_headers in production error mentions AUTH_MODE=google as fix", () => {
      process.env.AUTH_MODE = "dev_headers";
      process.env.NODE_ENV = "production";
      assert.throws(
        () => validateAuthConfig(),
        (err) => {
          assert.ok(err.message.includes("AUTH_MODE=google"));
          return true;
        },
      );
    });
  });
});

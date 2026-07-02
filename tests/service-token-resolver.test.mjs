import { strict as assert } from "assert";
import { describe, it } from "node:test";
import { parseServiceTokens } from "../dist/apps/api/src/modules/auth/service-token-resolver.js";

describe("service-token-resolver", () => {
  it("returns an empty map when unset", () => {
    const tokens = parseServiceTokens(undefined);
    assert.equal(tokens.size, 0);
  });

  it("returns an empty map for an empty string", () => {
    const tokens = parseServiceTokens("");
    assert.equal(tokens.size, 0);
  });

  it("parses a single name:token:role entry", () => {
    const tokens = parseServiceTokens("smoke:abc123:admin");
    assert.equal(tokens.size, 1);
    assert.deepEqual(tokens.get("abc123"), { name: "smoke", role: "admin" });
  });

  it("parses multiple comma-separated entries", () => {
    const tokens = parseServiceTokens(
      "creator:tok1:request_creator,owner:tok2:intake_owner,devops:tok3:devops_lead",
    );
    assert.equal(tokens.size, 3);
    assert.deepEqual(tokens.get("tok1"), { name: "creator", role: "request_creator" });
    assert.deepEqual(tokens.get("tok2"), { name: "owner", role: "intake_owner" });
    assert.deepEqual(tokens.get("tok3"), { name: "devops", role: "devops_lead" });
  });

  it("tolerates surrounding whitespace around entries", () => {
    const tokens = parseServiceTokens(" smoke : abc123 : admin , other:tok2:developer ");
    assert.equal(tokens.size, 2);
    assert.deepEqual(tokens.get("abc123"), { name: "smoke", role: "admin" });
  });

  it("throws on a malformed entry missing the role", () => {
    assert.throws(
      () => parseServiceTokens("smoke:abc123"),
      (err) => {
        assert.ok(err.message.includes("AUTH_SERVICE_TOKENS"));
        assert.ok(err.message.includes("smoke:abc123"));
        return true;
      },
    );
  });

  it("throws on an invalid role", () => {
    assert.throws(
      () => parseServiceTokens("smoke:abc123:superuser"),
      (err) => {
        assert.ok(err.message.includes('Invalid role "superuser"'));
        assert.ok(err.message.includes("smoke"));
        return true;
      },
    );
  });

  it("ignores blank entries from trailing commas", () => {
    const tokens = parseServiceTokens("smoke:abc123:admin,,");
    assert.equal(tokens.size, 1);
  });
});

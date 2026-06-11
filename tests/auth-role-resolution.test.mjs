import { strict as assert } from "assert";
import { describe, it } from "node:test";
import { resolveRoleFromEmail } from "../dist/apps/api/src/modules/auth/role-resolver.js";

const BASE_CONFIG = {
  adminEmails: ["admin@company.com"],
  intakeOwnerEmails: ["owner@company.com"],
  devopsLeadEmails: ["devops@company.com"],
  developerEmails: ["dev@company.com"],
  allowedEmails: [],
  allowedDomains: ["company.com"],
  defaultRole: "request_creator",
};

describe("auth-role-resolution", () => {
  it("assigns admin from AUTH_ADMIN_EMAILS", () => {
    const role = resolveRoleFromEmail("admin@company.com", BASE_CONFIG);
    assert.equal(role, "admin");
  });

  it("assigns intake_owner from AUTH_INTAKE_OWNER_EMAILS", () => {
    const role = resolveRoleFromEmail("owner@company.com", BASE_CONFIG);
    assert.equal(role, "intake_owner");
  });

  it("assigns devops_lead from AUTH_DEVOPS_LEAD_EMAILS", () => {
    const role = resolveRoleFromEmail("devops@company.com", BASE_CONFIG);
    assert.equal(role, "devops_lead");
  });

  it("assigns developer from AUTH_DEVELOPER_EMAILS", () => {
    const role = resolveRoleFromEmail("dev@company.com", BASE_CONFIG);
    assert.equal(role, "developer");
  });

  it("allowed domain user defaults to request_creator", () => {
    const role = resolveRoleFromEmail("random@company.com", BASE_CONFIG);
    assert.equal(role, "request_creator");
  });

  it("unknown domain returns null", () => {
    const role = resolveRoleFromEmail("user@external.com", BASE_CONFIG);
    assert.equal(role, null);
  });

  it("role precedence is deterministic — admin wins over owner", () => {
    const config = {
      ...BASE_CONFIG,
      intakeOwnerEmails: ["admin@company.com"],
    };
    const role = resolveRoleFromEmail("admin@company.com", config);
    assert.equal(role, "admin");
  });

  it("normalizes email to lowercase before matching", () => {
    const role = resolveRoleFromEmail("ADMIN@COMPANY.COM", BASE_CONFIG);
    assert.equal(role, "admin");
  });

  it("explicit email allowlist overrides domain check when configured", () => {
    const config = {
      ...BASE_CONFIG,
      allowedEmails: ["specific@other.com"],
      allowedDomains: [],
    };
    const allowed = resolveRoleFromEmail("specific@other.com", config);
    const denied = resolveRoleFromEmail("other@other.com", config);
    assert.equal(allowed, "request_creator");
    assert.equal(denied, null);
  });

  it("no restrictions allows all emails as defaultRole", () => {
    const config = {
      ...BASE_CONFIG,
      allowedEmails: [],
      allowedDomains: [],
    };
    const role = resolveRoleFromEmail("anyone@anywhere.org", config);
    assert.equal(role, "request_creator");
  });

  it("uses custom defaultRole when configured", () => {
    const config = {
      ...BASE_CONFIG,
      defaultRole: "developer",
      adminEmails: [],
      intakeOwnerEmails: [],
      devopsLeadEmails: [],
      developerEmails: [],
    };
    const role = resolveRoleFromEmail("user@company.com", config);
    assert.equal(role, "developer");
  });
});

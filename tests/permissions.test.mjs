import assert from "node:assert/strict";
import test from "node:test";
import {
  auditVisibilityForRole,
  canApproveGate1,
  canApproveGate2,
  canRetryProvisioning,
  canTriggerProvisioning,
  hasPermission,
  validateOverrideReason,
} from "../dist/src/index.js";

const intakeOwner = { id: "user-intake", role: "intake_owner" };
const devopsLead = { id: "user-devops", role: "devops_lead" };
const developer = { id: "user-dev", role: "developer" };
const admin = { id: "user-admin", role: "admin" };

test("request creator permissions are limited to own intake actions", () => {
  assert.equal(hasPermission("request_creator", "create_request"), true);
  assert.equal(hasPermission("request_creator", "edit_draft"), true);
  assert.equal(hasPermission("request_creator", "submit_request"), true);
  assert.equal(hasPermission("request_creator", "generate_evaluation"), false);
  assert.equal(hasPermission("request_creator", "approve_gate_1"), false);
  assert.equal(hasPermission("request_creator", "approve_gate_2"), false);
});

test("approval authority follows gate ownership", () => {
  const requestWithoutGate1 = { id: "REQ-1", status: "devops_review", approvals: {} };
  const requestWithGate1 = {
    id: "REQ-2",
    status: "devops_review",
    approvals: {
      gate_1: {
        gate: "gate_1",
        status: "approved",
        actorId: "user-intake",
        actorRole: "intake_owner",
        completedAt: "2026-05-26T00:00:00.000Z",
        locked: true,
      },
    },
  };

  assert.equal(canApproveGate1(intakeOwner), true);
  assert.equal(canApproveGate2(intakeOwner, requestWithGate1), false);
  assert.equal(canApproveGate2(devopsLead, requestWithoutGate1), false);
  assert.equal(canApproveGate2(devopsLead, requestWithGate1), true);
});

test("provisioning requires both permission and workflow readiness", () => {
  const readyRequest = {
    id: "REQ-3",
    status: "approved",
    approvals: {
      gate_1: {
        gate: "gate_1",
        status: "approved",
        actorId: "user-intake",
        actorRole: "intake_owner",
        completedAt: "2026-05-26T00:00:00.000Z",
        locked: true,
      },
      gate_2: {
        gate: "gate_2",
        status: "approved",
        actorId: "user-devops",
        actorRole: "devops_lead",
        completedAt: "2026-05-26T00:00:00.000Z",
        locked: true,
      },
    },
    distributionPackage: { validated: true },
  };

  assert.equal(canTriggerProvisioning(devopsLead, readyRequest), true);
  assert.equal(canTriggerProvisioning(developer, readyRequest), false);
  assert.equal(canRetryProvisioning(devopsLead, { ...readyRequest, status: "provisioning_failed" }), true);
});

test("admin permissions and audit visibility are explicit", () => {
  assert.equal(hasPermission("admin", "manage_integrations"), true);
  assert.equal(auditVisibilityForRole("admin"), "full");
  assert.equal(auditVisibilityForRole("developer"), "none");
  assert.equal(validateOverrideReason("restore_archived_request", "").valid, false);
  assert.equal(validateOverrideReason("restore_archived_request", "Approved admin recovery.").valid, true);
  assert.equal(canApproveGate1(admin), true);
});

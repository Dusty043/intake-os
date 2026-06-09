import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidTransitionError,
  WorkflowGuardError,
  applyWorkflowTransition,
  canStartProvisioning,
  getNextStatus,
  isApprovalComplete,
} from "../dist/src/index.js";

const now = "2026-05-26T00:00:00.000Z";
const creator = { id: "user-creator", role: "request_creator" };
const intakeOwner = { id: "user-intake", role: "intake_owner" };
const devopsLead = { id: "user-devops", role: "devops_lead" };

test("canonical workflow transitions are applied and audited", () => {
  const request = { id: "REQ-1", status: "draft", approvals: {} };

  const result = applyWorkflowTransition(request, "submit", creator, { now });

  assert.equal(result.request.status, "submitted");
  assert.equal(result.request.updatedAt, now);
  assert.equal(result.auditEvent.fromState, "draft");
  assert.equal(result.auditEvent.toState, "submitted");
  assert.equal(result.auditEvent.action, "submit");
  assert.equal(getNextStatus("submitted", "generate_evaluation"), "evaluating");
});

test("invalid transitions are rejected", () => {
  const request = { id: "REQ-2", status: "draft", approvals: {} };

  assert.throws(
    () => applyWorkflowTransition(request, "generate_evaluation", creator, { now }),
    InvalidTransitionError,
  );
});

test("approval gates are ordered, locked, and required before provisioning", () => {
  let request = { id: "REQ-3", status: "intake_review", approvals: {} };

  let result = applyWorkflowTransition(request, "approve", intakeOwner, {
    now,
    reason: "Gate 1 approved after intake review.",
  });
  request = result.request;

  assert.equal(request.status, "devops_review");
  assert.equal(isApprovalComplete(request, "gate_1"), true);
  assert.equal(request.approvals.gate_1.locked, true);

  assert.throws(
    () => applyWorkflowTransition({ id: "REQ-4", status: "devops_review", approvals: {} }, "approve", devopsLead, { now }),
    WorkflowGuardError,
  );

  result = applyWorkflowTransition(request, "approve", devopsLead, {
    now,
    reason: "Gate 2 approved by DevOps.",
  });
  request = result.request;

  assert.equal(request.status, "approved");
  assert.equal(isApprovalComplete(request, "gate_2"), true);
  assert.equal(canStartProvisioning(request), false);

  assert.throws(
    () => applyWorkflowTransition(request, "start_provisioning", devopsLead, { now }),
    WorkflowGuardError,
  );

  request = {
    ...request,
    distributionPackage: { validated: true, validationId: "PKG-1", validatedAt: now },
  };

  result = applyWorkflowTransition(request, "start_provisioning", devopsLead, { now });
  assert.equal(result.request.status, "provisioning");
  assert.equal(result.auditEvent.toState, "provisioning");
});

test("archived requests cannot be approved or provisioned without restoration", () => {
  const request = { id: "REQ-5", status: "archived", approvals: {} };

  assert.throws(
    () => applyWorkflowTransition(request, "approve", devopsLead, { now }),
    InvalidTransitionError,
  );

  assert.throws(
    () => applyWorkflowTransition(request, "start_provisioning", devopsLead, { now }),
    InvalidTransitionError,
  );
});

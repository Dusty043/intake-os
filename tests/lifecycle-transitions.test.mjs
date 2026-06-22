import { strict as assert } from "assert";
import { test, describe } from "node:test";

// Domain layer tests
const { validateLifecycleTransition, lifecycleTransitions } = await import(
  "../dist/src/domain/lifecycle-transitions.js"
);

describe("validateLifecycleTransition — valid transitions", () => {
  test("mark_started: distributed → in_progress", () => {
    const result = validateLifecycleTransition("mark_started", "distributed");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "in_progress");
  });

  test("mark_blocked: distributed → blocked", () => {
    const result = validateLifecycleTransition("mark_blocked", "distributed");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "blocked");
  });

  test("mark_blocked: in_progress → blocked", () => {
    const result = validateLifecycleTransition("mark_blocked", "in_progress");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "blocked");
  });

  test("unblock: blocked → in_progress", () => {
    const result = validateLifecycleTransition("unblock", "blocked");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "in_progress");
  });

  test("mark_completed: in_progress → completed", () => {
    const result = validateLifecycleTransition("mark_completed", "in_progress");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "completed");
  });

  test("mark_completed: blocked → completed", () => {
    const result = validateLifecycleTransition("mark_completed", "blocked");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "completed");
  });

  test("mark_canceled: distributed → canceled", () => {
    const result = validateLifecycleTransition("mark_canceled", "distributed");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "canceled");
  });

  test("mark_canceled: in_progress → canceled", () => {
    const result = validateLifecycleTransition("mark_canceled", "in_progress");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "canceled");
  });

  test("mark_canceled: blocked → canceled", () => {
    const result = validateLifecycleTransition("mark_canceled", "blocked");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "canceled");
  });

  test("archive: completed → archived", () => {
    const result = validateLifecycleTransition("archive", "completed");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "archived");
  });

  test("archive: canceled → archived", () => {
    const result = validateLifecycleTransition("archive", "canceled");
    assert.equal(result.ok, true);
    assert.equal(result.toStatus, "archived");
  });
});

describe("validateLifecycleTransition — invalid transitions", () => {
  test("mark_started from non-distributed is rejected", () => {
    const result = validateLifecycleTransition("mark_started", "draft");
    assert.equal(result.ok, false);
    assert.match(result.reason, /mark_started/);
    assert.match(result.reason, /draft/);
  });

  test("unblock from non-blocked is rejected", () => {
    const result = validateLifecycleTransition("unblock", "distributed");
    assert.equal(result.ok, false);
  });

  test("mark_completed from distributed is rejected", () => {
    const result = validateLifecycleTransition("mark_completed", "distributed");
    assert.equal(result.ok, false);
  });

  test("archive from in_progress is rejected", () => {
    const result = validateLifecycleTransition("archive", "in_progress");
    assert.equal(result.ok, false);
  });

  test("mark_started from approved is rejected", () => {
    const result = validateLifecycleTransition("mark_started", "approved");
    assert.equal(result.ok, false);
  });
});

// Service integration test
const { InMemoryProjectIntakeStore } = await import(
  "../dist/src/application/in-memory-store.js"
);
const { IntakeWorkflowService } = await import(
  "../dist/src/application/intake-workflow-service.js"
);

function makeActor(role = "intake_owner") {
  return { id: "user-1", role, displayName: "Test User" };
}

async function makeDistributedRecord(service, store) {
  // Create → submit → ... we'll directly inject a distributed record via store
  const record = {
    id: `intake-${Date.now()}`,
    title: "Test Project",
    description: "A distributed project",
    requester: "tester",
    projectType: "internal_tool",
    source: { system: "manual" },
    status: "distributed",
    createdAt: new Date().toISOString(),
    createdBy: makeActor(),
    externalLinks: [],
  };
  await store.saveIntake(record);
  return record;
}

describe("IntakeWorkflowService.executeLifecycleTransition", () => {
  test("mark_started moves distributed → in_progress", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    const updated = await service.executeLifecycleTransition(
      rec.id,
      "mark_started",
      makeActor(),
    );
    assert.equal(updated.status, "in_progress");
  });

  test("mark_blocked stores blockedReason and blockedAt", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    const updated = await service.executeLifecycleTransition(
      rec.id,
      "mark_blocked",
      makeActor(),
      { blockedReason: "Waiting on credentials" },
    );
    assert.equal(updated.status, "blocked");
    assert.equal(updated.blockedReason, "Waiting on credentials");
    assert.ok(updated.blockedAt);
  });

  test("unblock clears blockedReason", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    await service.executeLifecycleTransition(rec.id, "mark_blocked", makeActor(), {
      blockedReason: "Something",
    });
    const unblocked = await service.executeLifecycleTransition(rec.id, "unblock", makeActor());
    assert.equal(unblocked.status, "in_progress");
    assert.equal(unblocked.blockedReason, undefined);
    assert.ok(unblocked.unblockedAt);
  });

  test("mark_completed sets completedAt", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    await service.executeLifecycleTransition(rec.id, "mark_started", makeActor());
    const completed = await service.executeLifecycleTransition(
      rec.id,
      "mark_completed",
      makeActor(),
      { completedNote: "All done" },
    );
    assert.equal(completed.status, "completed");
    assert.ok(completed.completedAt);
    assert.equal(completed.completedNote, "All done");
  });

  test("mark_canceled sets canceledAt and canceledReason", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    const canceled = await service.executeLifecycleTransition(
      rec.id,
      "mark_canceled",
      makeActor(),
      { canceledReason: "Out of scope" },
    );
    assert.equal(canceled.status, "canceled");
    assert.ok(canceled.canceledAt);
    assert.equal(canceled.canceledReason, "Out of scope");
  });

  test("archive from completed sets archivedAt", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    await service.executeLifecycleTransition(rec.id, "mark_started", makeActor());
    await service.executeLifecycleTransition(rec.id, "mark_completed", makeActor());
    const archived = await service.executeLifecycleTransition(rec.id, "archive", makeActor());
    assert.equal(archived.status, "archived");
    assert.ok(archived.archivedAt);
  });

  test("invalid transition throws ValidationError", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    await assert.rejects(
      () => service.executeLifecycleTransition(rec.id, "unblock", makeActor()),
      (err) => {
        assert.ok(err.message.includes("unblock") || err.message.includes("not allowed"));
        return true;
      },
    );
  });

  test("transition appends audit event", async () => {
    const store = new InMemoryProjectIntakeStore();
    const service = new IntakeWorkflowService({ store });
    const rec = await makeDistributedRecord(service, store);

    await service.executeLifecycleTransition(rec.id, "mark_started", makeActor());
    const events = await store.listAuditEvents(rec.id);
    const ev = events.find((e) => e.action === "mark_started");
    assert.ok(ev, "audit event for mark_started should exist");
    assert.equal(ev.fromState, "distributed");
    assert.equal(ev.toState, "in_progress");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PrismaProjectIntakeStore } from "../../dist/apps/api/src/persistence/prisma-project-intake-store.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const NOW = "2026-07-15T10:00:00.000Z";

function makeRecord(overrides = {}) {
  return {
    id: "REQ-001",
    title: "Concurrent Write Regression",
    description: "Exercises the compare-and-swap save path in PrismaProjectIntakeStore.",
    requester: "Digital Solutions",
    department: "Internal Tools",
    projectType: "internal_tool",
    source: { system: "manual" },
    status: "submitted",
    approvals: {},
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: { id: "user-1", role: "request_creator", displayName: "Creator" },
    externalLinks: [],
    ...overrides,
  };
}

// Records calls and delegates to `impl(callNumber, args)` for the return value,
// avoiding any dependency on node:test's mock.fn() version-specific API.
// Same pattern as prisma-discovery-session-store.test.mjs.
function trackedMock(impl) {
  const fn = async (...args) => {
    fn.calls.push(args);
    return impl(fn.calls.length, ...args);
  };
  fn.calls = [];
  return fn;
}

function makePrisma({ findUniqueImpl, createImpl, updateManyImpl, upsertImpl }) {
  const projectIntake = {
    findUnique: trackedMock(findUniqueImpl ?? (() => null)),
    create: trackedMock(createImpl ?? (() => { throw new Error("create not expected"); })),
    updateMany: trackedMock(updateManyImpl ?? (() => { throw new Error("updateMany not expected"); })),
    upsert: trackedMock(upsertImpl ?? (() => { throw new Error("upsert not expected"); })),
  };
  return {
    projectIntake,
    $transaction: async (callback) => callback({ projectIntake }),
  };
}

// ─── saveIntake(record, { expectedUpdatedAt }) — compare-and-swap (Q-CONC-1) ──

describe("PrismaProjectIntakeStore.saveIntake — compare-and-swap", () => {
  it("creates directly when no row exists yet — nothing to conflict with", async () => {
    const record = makeRecord();
    const prisma = makePrisma({
      findUniqueImpl: (callNumber) => (callNumber === 1 ? null : { recordSnapshot: record }),
      createImpl: () => ({ recordSnapshot: record }),
    });
    const store = new PrismaProjectIntakeStore(prisma);

    const saved = await store.saveIntake(record, { expectedUpdatedAt: record.updatedAt });

    assert.ok(saved);
    assert.equal(saved.id, "REQ-001");
    assert.equal(prisma.projectIntake.create.calls.length, 1);
    assert.equal(prisma.projectIntake.updateMany.calls.length, 0);
  });

  it("writes successfully when the expected updatedAt still matches the row", async () => {
    const record = makeRecord({ status: "evaluating" });
    const prisma = makePrisma({
      findUniqueImpl: (callNumber) =>
        callNumber === 1 ? { id: "REQ-001" } : { recordSnapshot: record },
      updateManyImpl: () => ({ count: 1 }),
    });
    const store = new PrismaProjectIntakeStore(prisma);

    const saved = await store.saveIntake(record, { expectedUpdatedAt: NOW });

    assert.ok(saved);
    assert.equal(saved.status, "evaluating");
    assert.equal(prisma.projectIntake.updateMany.calls.length, 1);
    const [{ where }] = prisma.projectIntake.updateMany.calls[0];
    assert.equal(where.id, "REQ-001");
    assert.equal(where.updatedAt.toISOString(), new Date(NOW).toISOString());
  });

  it("returns null on a conflict instead of overwriting a concurrent writer's change", async () => {
    // Simulates another request having already updated this intake's `updatedAt`
    // between our read and write (e.g. the discovery hand-off's background
    // auto-draft job racing a manual retry — see TASK-0057/Q-CONC-1).
    const record = makeRecord({ status: "evaluating" });
    const prisma = makePrisma({
      findUniqueImpl: () => ({ id: "REQ-001" }),
      updateManyImpl: () => ({ count: 0 }),
    });
    const store = new PrismaProjectIntakeStore(prisma);

    const saved = await store.saveIntake(record, { expectedUpdatedAt: "2026-07-15T09:00:00.000Z" });

    assert.equal(saved, null);
    assert.equal(prisma.projectIntake.updateMany.calls.length, 1);
    // The create/upsert paths must never run on a detected conflict.
    assert.equal(prisma.projectIntake.create.calls.length, 0);
  });

  it("a plain call with no options always upserts unconditionally (existing behavior, unaffected)", async () => {
    const record = makeRecord();
    const prisma = makePrisma({
      upsertImpl: () => ({ recordSnapshot: record }),
    });
    const store = new PrismaProjectIntakeStore(prisma);

    const saved = await store.saveIntake(record);

    assert.ok(saved);
    assert.equal(saved.id, "REQ-001");
    assert.equal(prisma.projectIntake.upsert.calls.length, 1);
    assert.equal(prisma.projectIntake.updateMany.calls.length, 0);
  });
});

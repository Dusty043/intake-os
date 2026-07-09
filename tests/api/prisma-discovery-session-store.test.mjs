import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PrismaDiscoverySessionStore } from "../../dist/apps/api/src/persistence/prisma-discovery-session-store.js";
import { ConflictError } from "../../dist/src/application/errors.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const NOW = "2026-07-07T10:00:00.000Z";

function makeSession(overrides = {}) {
  return {
    id: "DISC-001",
    userId: "USER-001",
    status: "draft",
    messages: [],
    timeline: [],
    intent: null,
    problemFrame: null,
    solutionOptions: [],
    clarificationQuestions: [],
    selectedSolutionId: null,
    proposal: null,
    manifest: null,
    confidence: {
      problemUnderstanding: 0,
      solutionFit: 0,
      scopeClarity: 0,
      technicalFeasibility: 0,
      stakeholderClarity: 0,
      downstreamMapping: 0,
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// Records calls and delegates to `impl(callNumber, args)` for the return value,
// avoiding any dependency on node:test's mock.fn() version-specific API.
function trackedMock(impl) {
  const fn = async (...args) => {
    fn.calls.push(args);
    return impl(fn.calls.length, ...args);
  };
  fn.calls = [];
  return fn;
}

function makePrisma({ findUniqueImpl, updateManyImpl }) {
  return {
    discoverySessionRecord: {
      findUnique: trackedMock(findUniqueImpl),
      updateMany: trackedMock(updateManyImpl),
    },
  };
}

// ─── update() ─────────────────────────────────────────────────────────────────

describe("PrismaDiscoverySessionStore.update", () => {
  it("succeeds on the first attempt and returns the merged session", async () => {
    const session = makeSession();
    const rowUpdatedAt = new Date(NOW);
    const prisma = makePrisma({
      findUniqueImpl: () => ({ snapshot: session, updatedAt: rowUpdatedAt }),
      updateManyImpl: () => ({ count: 1 }),
    });
    const store = new PrismaDiscoverySessionStore(prisma);

    const result = await store.update("DISC-001", { status: "intent_detected" });

    assert.equal(result.status, "intent_detected");
    assert.equal(result.id, "DISC-001");
    assert.equal(prisma.discoverySessionRecord.findUnique.calls.length, 1);
    assert.equal(prisma.discoverySessionRecord.updateMany.calls.length, 1);
    const [{ where }] = prisma.discoverySessionRecord.updateMany.calls[0];
    assert.equal(where.id, "DISC-001");
    assert.equal(where.updatedAt, rowUpdatedAt);
  });

  it("retries on concurrent-write conflicts and succeeds using a freshly re-read snapshot each attempt", async () => {
    // Simulates another writer bumping the row between our read and write on
    // attempts 1 and 2; attempt 3's read reflects that writer's change.
    const snapshots = [
      makeSession({ updatedAt: "2026-07-07T10:00:00.000Z", selectedSolutionId: null }),
      makeSession({ updatedAt: "2026-07-07T10:00:01.000Z", selectedSolutionId: "SOL-1" }),
      makeSession({ updatedAt: "2026-07-07T10:00:02.000Z", selectedSolutionId: "SOL-2" }),
    ];
    const prisma = makePrisma({
      findUniqueImpl: (callNumber) => ({
        snapshot: snapshots[callNumber - 1],
        updatedAt: new Date(snapshots[callNumber - 1].updatedAt),
      }),
      updateManyImpl: (callNumber) => ({ count: callNumber === 3 ? 1 : 0 }),
    });
    const store = new PrismaDiscoverySessionStore(prisma);

    const result = await store.update("DISC-001", { status: "clarification_needed" });

    assert.equal(prisma.discoverySessionRecord.findUnique.calls.length, 3);
    assert.equal(prisma.discoverySessionRecord.updateMany.calls.length, 3);
    // Final result must be merged from attempt 3's fresh read, not attempt 1's stale one.
    assert.equal(result.selectedSolutionId, "SOL-2");
    assert.equal(result.status, "clarification_needed");
  });

  it("throws ConflictError once retries are exhausted", async () => {
    const session = makeSession();
    const prisma = makePrisma({
      findUniqueImpl: () => ({ snapshot: session, updatedAt: new Date(session.updatedAt) }),
      updateManyImpl: () => ({ count: 0 }),
    });
    const store = new PrismaDiscoverySessionStore(prisma);

    await assert.rejects(
      () => store.update("DISC-001", { status: "proposal_generated" }),
      ConflictError,
    );
    assert.equal(prisma.discoverySessionRecord.findUnique.calls.length, 3);
    assert.equal(prisma.discoverySessionRecord.updateMany.calls.length, 3);
  });
});

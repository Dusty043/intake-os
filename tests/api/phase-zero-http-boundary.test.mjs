import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DiscoveryHttpController } from "../../dist/apps/api/src/modules/discovery/discovery.controller.js";
import { IntakeHttpController } from "../../dist/apps/api/src/modules/intake/intake.controller.js";
import { DiscoveryStreamRegistry } from "../../dist/src/application/discovery/discovery-stream-registry.js";

const ACTOR = { id: "user-1", name: "User", role: "request_creator" };
const SESSION = {
  id: "discovery-1",
  userId: ACTOR.id,
  status: "direction_selected",
  messages: [],
  timeline: [],
  intent: null,
  problemFrame: null,
  solutionOptions: [],
  clarificationQuestions: [],
  selectedSolutionId: "solution-1",
  proposal: null,
  manifest: null,
  linkedIntakeId: "internal-intake-1",
  confidence: {
    problemUnderstanding: 1,
    solutionFit: 1,
    scopeClarity: 1,
    technicalFeasibility: 1,
    stakeholderClarity: 1,
    downstreamMapping: 1,
  },
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
};

describe("Phase 0 HTTP boundary", () => {
  test("generation stays owner-scoped and strips the internal intake id", async () => {
    const discovery = { getSession: async () => SESSION };
    const phaseZero = {
      queue: async () => SESSION,
      getPacket: async () => ({ state: "ready", documents: [] }),
    };
    const controller = new DiscoveryHttpController(discovery, new DiscoveryStreamRegistry(), phaseZero);

    const response = await controller.generatePhaseZero(SESSION.id, { force: true }, ACTOR);
    assert.equal(response.linkedIntakeId, undefined);
    await assert.rejects(
      () => controller.getPhaseZero(SESSION.id, { ...ACTOR, id: "other-user" }),
      (error) => error.name === "NotFoundError",
    );
  });

  test("legacy Discovery manifest and intake handoff endpoints return 410", async () => {
    const controller = new DiscoveryHttpController(
      { getSession: async () => SESSION },
      new DiscoveryStreamRegistry(),
      {},
    );
    await assert.rejects(() => controller.generateManifest(SESSION.id, ACTOR), (error) => error.getStatus() === 410);
    await assert.rejects(() => controller.sendToEvaluation(SESSION.id, ACTOR), (error) => error.getStatus() === 410);
  });
});

describe("legacy provisioning shutdown", () => {
  test("all provisioning mutation endpoints return 410 before touching the workflow service", async () => {
    const controller = new IntakeHttpController({});
    assert.throws(() => controller.generateProvisioningPlan("intake-1", {}, ACTOR), (error) => error.getStatus() === 410);
    assert.throws(() => controller.markReadyForProvisioning("intake-1", ACTOR), (error) => error.getStatus() === 410);
    await assert.rejects(() => controller.executeDistribution("intake-1", ACTOR), (error) => error.getStatus() === 410);
    await assert.rejects(() => controller.retryProvisioningRun("intake-1", "run-1", ACTOR), (error) => error.getStatus() === 410);
    await assert.rejects(
      () => controller.markProvisioningTargetResolved("intake-1", "target-1", { note: "n/a" }, ACTOR),
      (error) => error.getStatus() === 410,
    );
  });
});

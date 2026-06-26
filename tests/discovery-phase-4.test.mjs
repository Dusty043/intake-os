/**
 * DISCOVERY ENGINE - Phase 4 Tests
 * Provisioning manifest generation.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryDiscoverySessionStore,
  DiscoveryOrchestrator,
  DiscoveryController,
  MockIntentExtractionAgent,
  MockProblemFramingAgent,
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
  MockManifestGeneratorAgent,
} from "../dist/src/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let counter = 0;
function idFactory(prefix) {
  return `${prefix}_p4_${++counter}`;
}
function fixedNow() {
  return "2026-06-26T00:00:00.000Z";
}

function makeOrchestrator() {
  const store = new InMemoryDiscoverySessionStore();
  const orchestrator = new DiscoveryOrchestrator(
    store,
    new MockIntentExtractionAgent(),
    new MockProblemFramingAgent(),
    new MockSolutionGenerationAgent(),
    new MockClarificationAgent(),
    new MockProposalComposerAgent(),
    new MockManifestGeneratorAgent(),
    { idFactory, now: fixedNow },
  );
  return { store, orchestrator };
}

async function startSelectAndManifest(orchestrator, message) {
  const session = await orchestrator.startDiscovery({ userId: "u1", rawMessage: message });
  const withSols = await orchestrator.generateSolutions(session.id);
  const sol = withSols.solutionOptions.find((s) => s.isRecommended) ?? withSols.solutionOptions[0];
  await orchestrator.selectDirection({ sessionId: session.id, solutionId: sol.id });
  return orchestrator.generateManifest(session.id);
}

// ─── MockManifestGeneratorAgent — shape ───────────────────────────────────────

describe("MockManifestGeneratorAgent — manifest shape", () => {
  test("manifest is set on session after generateManifest", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "Our support team answers the same questions every day.",
    );
    assert.ok(session.manifest !== null, "manifest should be set on session");
  });

  test("manifest has required top-level fields", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "We need to automate our invoice approval process.",
    );
    const m = session.manifest;
    assert.equal(m.manifestVersion, "1.0");
    assert.equal(m.source, "discovery_engine");
    assert.ok(m.proposalId, "proposalId must be set");
    assert.ok(
      ["create_project", "create_epic", "create_task", "create_microtask", "process_change", "defer", "archive"].includes(m.recommendedAction),
      `invalid recommendedAction: ${m.recommendedAction}`,
    );
    assert.equal(m.readyForLiveAdapter, false);
    assert.equal(m.generatedAt, fixedNow());
  });

  test("monday block has required fields", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "Our support team answers the same questions every day.",
    );
    const { monday } = session.manifest;
    assert.ok(Array.isArray(monday.roadmapEpics), "roadmapEpics must be array");
    assert.ok(Array.isArray(monday.sprintTasks), "sprintTasks must be array");
    assert.ok(Array.isArray(monday.credentialsVault), "credentialsVault must be array");
    assert.ok(Array.isArray(monday.microtasksOps), "microtasksOps must be array");
  });

  test("github block has required fields", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "We need to automate our invoice approval process.",
    );
    const { github } = session.manifest;
    assert.equal(typeof github.createRepo, "boolean");
    assert.ok(Array.isArray(github.labels), "labels must be array");
  });

  test("monday.roadmapEpics comes from proposal suggestedEpics", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "Our invoices take too long to approve. The finance team is frustrated.",
    );
    const m = session.manifest;
    const proposal = session.proposal;
    if (proposal && proposal.suggestedEpics.length > 0 && m.recommendedAction !== "defer" && m.recommendedAction !== "archive") {
      const epicTitles = m.monday.roadmapEpics.map((e) => e.title);
      assert.deepEqual(epicTitles, proposal.suggestedEpics);
    }
  });

  test("proposalId matches the session proposal id", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "Our support team is overwhelmed with repetitive questions.",
    );
    assert.ok(session.proposal, "proposal should be set");
    assert.equal(session.manifest.proposalId, session.proposal.id);
  });
});

// ─── Intent → recommendedAction routing ──────────────────────────────────────

describe("MockManifestGeneratorAgent — recommended action routing", () => {
  test("microtask intent routes to create_microtask or create_task", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "Quick small tweak needed on the login page.",
    );
    assert.ok(
      ["create_microtask", "create_task"].includes(session.manifest.recommendedAction),
      `expected microtask/task action, got: ${session.manifest.recommendedAction}`,
    );
  });

  test("project-level intents set monday.projectsPortfolio", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "We need to build a knowledge base chatbot for our customers.",
    );
    if (session.manifest.recommendedAction === "create_project") {
      assert.ok(
        session.manifest.monday.projectsPortfolio !== null,
        "create_project should set monday.projectsPortfolio",
      );
      assert.ok(
        session.manifest.monday.projectsPortfolio.name.length > 0,
        "project name should be non-empty",
      );
    }
  });

  test("github.repoName is slug-formatted when createRepo is true", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startSelectAndManifest(
      orchestrator,
      "We need to build a new internal portal for our operations team.",
    );
    if (session.manifest.github.createRepo) {
      const name = session.manifest.github.repoName;
      assert.ok(name, "repoName must be set when createRepo is true");
      assert.ok(/^[a-z0-9-]+$/.test(name), `repoName "${name}" must be lowercase alphanumeric + hyphens`);
    }
  });
});

// ─── orchestrator.generateManifest ────────────────────────────────────────────

describe("DiscoveryOrchestrator.generateManifest", () => {
  test("auto-composes proposal if not yet done", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "u1",
      rawMessage: "Our support team answers the same questions every day.",
    });
    const withSols = await orchestrator.generateSolutions(session.id);
    const sol = withSols.solutionOptions[0];
    await orchestrator.selectDirection({ sessionId: session.id, solutionId: sol.id });

    assert.equal(session.proposal, null, "proposal should be null before generateManifest");
    const result = await orchestrator.generateManifest(session.id);
    assert.ok(result.proposal !== null, "proposal should be auto-composed");
    assert.ok(result.manifest !== null, "manifest should be set");
  });

  test("throws if no solution selected", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({ userId: "u1", rawMessage: "Test." });
    await assert.rejects(
      () => orchestrator.generateManifest(session.id),
      /no solution selected/i,
    );
  });

  test("throws for unknown session id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(
      () => orchestrator.generateManifest("nope"),
      /not found/i,
    );
  });
});

// ─── Controller Phase 4 ───────────────────────────────────────────────────────

describe("DiscoveryController Phase 4", () => {
  test("generateManifest delegates to orchestrator", async () => {
    const { orchestrator } = makeOrchestrator();
    const controller = new DiscoveryController(orchestrator);

    const session = await controller.startDiscovery({
      userId: "u1",
      message: "Our support team is overwhelmed with repetitive questions.",
    });
    const withSols = await controller.generateSolutions(session.id);
    const sol = withSols.solutionOptions[0];
    await controller.selectDirection(session.id, { solutionId: sol.id });

    const result = await controller.generateManifest(session.id);
    assert.ok(result.manifest !== null, "manifest should be set");
  });
});

// ─── End-to-end Phase 1+2+3+4 flow ───────────────────────────────────────────

describe("End-to-end: vague ask → provisioning manifest", () => {
  test("full happy path through all four phases", async () => {
    const { orchestrator } = makeOrchestrator();

    // 1. Start discovery
    const session = await orchestrator.startDiscovery({
      userId: "u1",
      rawMessage: "Our support team answers the same customer questions every day. It is slow and frustrating.",
    });

    // 2. Generate solutions
    const withSolutions = await orchestrator.generateSolutions(session.id);
    assert.ok(withSolutions.solutionOptions.length >= 2);

    // 3. Select direction
    const recommended = withSolutions.solutionOptions.find((s) => s.isRecommended);
    const directed = await orchestrator.selectDirection({
      sessionId: session.id,
      solutionId: recommended.id,
    });
    assert.equal(directed.status, "direction_selected");

    // 4. Generate manifest (auto-composes proposal)
    const final = await orchestrator.generateManifest(directed.id);
    assert.ok(final.proposal !== null, "proposal should be auto-composed");
    assert.ok(final.manifest !== null, "manifest should be set");
    assert.ok(final.manifest.proposalId, "manifest should reference proposal");
    assert.ok(
      ["create_project", "create_epic", "create_task", "create_microtask", "process_change", "defer", "archive"]
        .includes(final.manifest.recommendedAction),
    );
  });
});

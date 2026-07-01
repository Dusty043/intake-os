/**
 * DISCOVERY ENGINE - Phase 1 Tests
 * Discovery core: session creation, intent extraction, problem framing, confidence gating.
 */

import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  // Domain
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
  MockManifestGeneratorAgent,
  overallConfidence,
  confidenceTier,
  emptyConfidence,
  emptyProjectProposal,
  // Application
  InMemoryDiscoverySessionStore,
  DiscoveryOrchestrator,
  DiscoveryController,
  MockIntentExtractionAgent,
  MockProblemFramingAgent,
  NotFoundError,
} from "../dist/src/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let counter = 0;
function idFactory(prefix) {
  return `${prefix}_test_${++counter}`;
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

// ─── Confidence domain ────────────────────────────────────────────────────────

describe("overallConfidence", () => {
  test("returns 0 for all-zero confidence", () => {
    assert.equal(overallConfidence(emptyConfidence()), 0);
  });

  test("averages all six dimensions", () => {
    const c = {
      problemUnderstanding: 0.6,
      solutionFit: 0.6,
      scopeClarity: 0.6,
      technicalFeasibility: 0.6,
      stakeholderClarity: 0.6,
      downstreamMapping: 0.6,
    };
    assert.equal(overallConfidence(c), 0.6);
  });
});

describe("confidenceTier", () => {
  test("keep_discovering when overall <= 0.40", () => {
    const c = emptyConfidence();
    assert.equal(confidenceTier(c), "keep_discovering");
  });

  test("rough_frame when overall is ~0.50", () => {
    const c = {
      problemUnderstanding: 0.5,
      solutionFit: 0.5,
      scopeClarity: 0.5,
      technicalFeasibility: 0.5,
      stakeholderClarity: 0.5,
      downstreamMapping: 0.5,
    };
    assert.equal(confidenceTier(c), "rough_frame");
  });

  test("propose_with_assumptions when overall is ~0.72", () => {
    const c = {
      problemUnderstanding: 0.72,
      solutionFit: 0.72,
      scopeClarity: 0.72,
      technicalFeasibility: 0.72,
      stakeholderClarity: 0.72,
      downstreamMapping: 0.72,
    };
    assert.equal(confidenceTier(c), "propose_with_assumptions");
  });

  test("recommend_evaluation when overall > 0.80", () => {
    const c = {
      problemUnderstanding: 0.9,
      solutionFit: 0.9,
      scopeClarity: 0.9,
      technicalFeasibility: 0.9,
      stakeholderClarity: 0.9,
      downstreamMapping: 0.9,
    };
    assert.equal(confidenceTier(c), "recommend_evaluation");
  });
});

// ─── In-memory session store ──────────────────────────────────────────────────

describe("InMemoryDiscoverySessionStore", () => {
  let store;
  beforeEach(() => { store = new InMemoryDiscoverySessionStore(); });

  test("create and retrieve a session", async () => {
    const now = fixedNow();
    const session = await store.create({
      id: "ds_001",
      userId: "user_1",
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
      confidence: emptyConfidence(),
      createdAt: now,
      updatedAt: now,
    });
    assert.equal(session.id, "ds_001");

    const found = await store.getById("ds_001");
    assert.ok(found);
    assert.equal(found.userId, "user_1");
  });

  test("returns null for unknown session", async () => {
    const result = await store.getById("nonexistent");
    assert.equal(result, null);
  });

  test("update patches fields without losing others", async () => {
    const now = fixedNow();
    await store.create({
      id: "ds_002",
      userId: "user_1",
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
      confidence: emptyConfidence(),
      createdAt: now,
      updatedAt: now,
    });
    const updated = await store.update("ds_002", { status: "conversation_started" });
    assert.equal(updated.status, "conversation_started");
    assert.equal(updated.userId, "user_1"); // not lost
  });

  test("listByUser returns only sessions for that user", async () => {
    const now = fixedNow();
    const base = {
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
      confidence: emptyConfidence(),
      createdAt: now,
      updatedAt: now,
    };
    await store.create({ id: "ds_a", userId: "user_A", ...base });
    await store.create({ id: "ds_b", userId: "user_B", ...base });
    await store.create({ id: "ds_c", userId: "user_A", ...base });

    const userASessions = await store.listByUser("user_A");
    assert.equal(userASessions.length, 2);
    assert.ok(userASessions.every((s) => s.userId === "user_A"));
  });
});

// ─── Discovery orchestrator ───────────────────────────────────────────────────

describe("DiscoveryOrchestrator.startDiscovery", () => {
  test("creates a session with the raw message stored", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user_1",
      rawMessage: "Support keeps answering the same questions.",
    });

    assert.ok(session.id);
    assert.equal(session.userId, "user_1");
    assert.equal(session.messages.length, 1);
    assert.equal(session.messages[0].role, "user");
    assert.ok(session.messages[0].content.includes("same questions"));
  });

  test("sets intent after first message", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user_1",
      rawMessage: "Support keeps answering the same questions every day.",
    });

    assert.ok(session.intent, "intent should be populated");
    assert.ok(session.intent.intentType);
  });

  test("produces a problem frame after first message", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user_1",
      rawMessage: "Our support team manually answers the same questions from customers every day.",
    });

    assert.ok(session.problemFrame, "problemFrame should be populated");
    assert.ok(session.problemFrame.problemStatement.length > 0);
    assert.ok(Array.isArray(session.problemFrame.unknowns));
  });

  test("session advances from draft status", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user_1",
      rawMessage: "We need to automate our invoice approval process.",
    });
    assert.notEqual(session.status, "draft");
  });

  test("detects solution bias for chatbot requests", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user_1",
      rawMessage: "We need a chatbot to help our customers.",
    });

    assert.ok(session.intent?.solutionBiasDetected, "should detect chatbot solution bias");
  });
});

describe("DiscoveryOrchestrator.addMessage", () => {
  test("appends message and re-analyses", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user_1",
      rawMessage: "Something is slow.",
    });

    const updated = await orchestrator.addMessage({
      sessionId: session.id,
      content: "Our finance team manually reviews invoices and it takes 3 days.",
    });

    assert.equal(updated.messages.length, 2);
    assert.ok(updated.problemFrame);
  });

  test("throws for unknown session id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(
      () => orchestrator.addMessage({ sessionId: "bad_id", content: "hello" }),
      /not found/i,
    );
  });

  test("never regresses session status", async () => {
    const { orchestrator } = makeOrchestrator();
    const first = await orchestrator.startDiscovery({
      userId: "user_1",
      rawMessage: "Our support team manually answers the same questions from customers every day because our knowledge base is outdated.",
    });
    const firstStatus = first.status;

    const second = await orchestrator.addMessage({
      sessionId: first.id,
      content: "ok",
    });

    const rank = {
      draft: 0,
      conversation_started: 1,
      intent_detected: 2,
      problem_framed: 3,
      solutions_generated: 4,
      clarification_needed: 4,
      direction_selected: 5,
      proposal_generated: 6,
      evaluation_ready: 7,
      sent_to_evaluation: 8,
    };
    assert.ok(rank[second.status] >= rank[firstStatus], "status should not regress");
  });
});

describe("DiscoveryOrchestrator.getSession", () => {
  test("retrieves session by id", async () => {
    const { orchestrator } = makeOrchestrator();
    const created = await orchestrator.startDiscovery({ userId: "u1", rawMessage: "test" });
    const fetched = await orchestrator.getSession(created.id);
    assert.equal(fetched.id, created.id);
  });

  test("throws for unknown id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(() => orchestrator.getSession("nope"), /not found/i);
  });

  // TASK-0040: not-found cases now throw the application's NotFoundError (mapped to a
  // clean 404 by the API's exception filter) instead of a raw Error (generic 500).
  test("throws NotFoundError, not a generic Error, for unknown id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(() => orchestrator.getSession("nope"), (err) => {
      assert.ok(err instanceof NotFoundError, `expected NotFoundError, got ${err.constructor.name}`);
      return true;
    });
  });
});

// ─── Discovery controller ─────────────────────────────────────────────────────

describe("DiscoveryController", () => {
  test("startDiscovery returns a session", async () => {
    const { orchestrator } = makeOrchestrator();
    const controller = new DiscoveryController(orchestrator);
    const session = await controller.startDiscovery({
      userId: "user_1",
      message: "Invoices take forever to approve.",
    });
    assert.ok(session.id);
    assert.equal(session.userId, "user_1");
  });

  test("addMessage delegates to orchestrator", async () => {
    const { orchestrator } = makeOrchestrator();
    const controller = new DiscoveryController(orchestrator);
    const session = await controller.startDiscovery({
      userId: "user_1",
      message: "We have a manual billing process.",
    });
    const updated = await controller.addMessage(session.id, {
      message: "It affects the finance team and takes 5 days per invoice.",
    });
    assert.equal(updated.messages.length, 2);
  });
});

// ─── emptyProjectProposal ─────────────────────────────────────────────────────

describe("emptyProjectProposal", () => {
  test("all dimension slots start null with confidence 0", () => {
    const proposal = emptyProjectProposal("p1", "ds1", fixedNow());
    const dims = [
      "problemFrame", "requirements", "systemDesign", "scalability",
      "reliability", "observability", "securityDesign", "infrastructure",
      "costEngineering", "tradeoffs", "documentation",
    ];
    for (const dim of dims) {
      assert.equal(proposal[dim].value, null, `${dim}.value should be null`);
      assert.equal(proposal[dim].confidence, 0, `${dim}.confidence should be 0`);
    }
  });

  test("status starts as draft", () => {
    const proposal = emptyProjectProposal("p1", "ds1", fixedNow());
    assert.equal(proposal.status, "draft");
  });
});

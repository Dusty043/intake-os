/**
 * DISCOVERY ENGINE - Phase 2 Tests
 * Solution generation, clarification (dimension-guided), direction selection.
 */

import { describe, test, beforeEach } from "node:test";
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
  emptyConfidence,
} from "../dist/src/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let counter = 0;
function idFactory(prefix) {
  return `${prefix}_p2_${++counter}`;
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
    { idFactory, now: fixedNow },
  );
  return { store, orchestrator };
}

async function startAndGenerate(orchestrator, message) {
  const session = await orchestrator.startDiscovery({ userId: "u1", rawMessage: message });
  return orchestrator.generateSolutions(session.id);
}

// ─── Solution generation ──────────────────────────────────────────────────────

describe("MockSolutionGenerationAgent — solution options", () => {
  test("generates 2 or more solution options", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need to automate our invoice approval process.",
    );
    assert.ok(session.solutionOptions.length >= 2, "should generate at least 2 options");
  });

  test("exactly one option is marked recommended", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need to automate our invoice approval process.",
    );
    const recommended = session.solutionOptions.filter((s) => s.isRecommended);
    assert.equal(recommended.length, 1, "exactly one option should be recommended");
  });

  test("all options have required fields", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "Support keeps answering the same questions.",
    );
    for (const opt of session.solutionOptions) {
      assert.ok(opt.id, "option must have id");
      assert.ok(opt.title, "option must have title");
      assert.ok(opt.summary, "option must have summary");
      assert.ok(opt.whenItFits, "option must have whenItFits");
      assert.ok(opt.whenItIsWrong, "option must have whenItIsWrong");
      assert.ok(["low", "medium", "high"].includes(opt.complexity), "complexity must be low/medium/high");
      assert.ok(Array.isArray(opt.dependencies), "dependencies must be array");
      assert.ok(Array.isArray(opt.risks), "risks must be array");
      assert.ok(opt.expectedUpside, "option must have expectedUpside");
      assert.ok(typeof opt.rank === "number", "rank must be number");
    }
  });

  test("options are ranked sequentially from 1", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need a dashboard to track our KPIs.",
    );
    const ranks = session.solutionOptions.map((s) => s.rank);
    assert.deepEqual(ranks, ranks.map((_, i) => i + 1));
  });

  test("ai_assistant intent produces AI-specific options", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need a chatbot to answer customer questions automatically.",
    );
    const titles = session.solutionOptions.map((s) => s.title);
    assert.ok(
      titles.some((t) => t.toLowerCase().includes("knowledge") || t.toLowerCase().includes("assistant") || t.toLowerCase().includes("deflect")),
      "AI assistant intent should produce relevant options",
    );
  });

  test("session transitions to solutions_generated or clarification_needed", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need to automate our onboarding process.",
    );
    assert.ok(
      ["solutions_generated", "clarification_needed"].includes(session.status),
      `unexpected status: ${session.status}`,
    );
  });
});

// ─── Clarification agent ──────────────────────────────────────────────────────

describe("MockClarificationAgent — dimension-guided questions", () => {
  test("generates clarification questions after solutions", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "Invoices take forever.",
    );
    // May or may not have clarifications depending on confidence, but structure is valid
    for (const q of session.clarificationQuestions) {
      assert.ok(q.id, "question must have id");
      assert.ok(q.question.length > 10, "question text must be substantive");
      assert.ok(["blocking", "important", "deferred"].includes(q.impact), "impact must be valid");
      assert.ok(Array.isArray(q.affectedDimensions), "affectedDimensions must be array");
      assert.equal(q.answered, false, "new questions should be unanswered");
    }
  });

  test("max 2 questions per generation turn", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(orchestrator, "Something is slow.");
    assert.ok(session.clarificationQuestions.length <= 2, "should generate at most 2 questions per turn");
  });

  test("questions do not repeat the same text twice", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(orchestrator, "Something is slow.");
    const texts = session.clarificationQuestions.map((q) => q.question);
    const unique = new Set(texts);
    assert.equal(unique.size, texts.length, "question texts should be unique");
  });

  test("microtask intent generates fewer or simpler questions", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "Quick small tweak needed on the login page.",
    );
    // Microtask questions should not ask about disaster recovery or compliance
    for (const q of session.clarificationQuestions) {
      assert.ok(!q.question.toLowerCase().includes("disaster"), "microtask should not ask about disaster recovery");
    }
  });
});

// ─── Answer clarification ─────────────────────────────────────────────────────

describe("DiscoveryOrchestrator.answerClarification", () => {
  test("marks question as answered", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(orchestrator, "Our invoices take too long to process.");

    if (session.clarificationQuestions.length === 0) {
      // No questions generated (high confidence) — skip this test
      return;
    }

    const q = session.clarificationQuestions[0];
    const updated = await orchestrator.answerClarification({
      sessionId: session.id,
      questionId: q.id,
      answer: "It affects our internal finance team of 5 people.",
    });

    const answeredQ = updated.clarificationQuestions.find((cq) => cq.id === q.id);
    assert.ok(answeredQ, "question should still exist");
    assert.equal(answeredQ.answered, true, "question should be marked answered");
    assert.equal(answeredQ.answer, "It affects our internal finance team of 5 people.");
  });

  test("appends answer as a user message for re-analysis", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(orchestrator, "Something is broken in our process.");

    if (session.clarificationQuestions.length === 0) return;

    const q = session.clarificationQuestions[0];
    const msgCountBefore = session.messages.length;

    const updated = await orchestrator.answerClarification({
      sessionId: session.id,
      questionId: q.id,
      answer: "Internal staff, about 20 people.",
    });

    assert.ok(updated.messages.length > msgCountBefore, "should add the answer as a message");
  });

  test("throws for unknown question id", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({ userId: "u1", rawMessage: "test" });

    await assert.rejects(
      () => orchestrator.answerClarification({ sessionId: session.id, questionId: "bad_q", answer: "x" }),
      /not found/i,
    );
  });

  test("throws for unknown session id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(
      () => orchestrator.answerClarification({ sessionId: "nope", questionId: "q1", answer: "x" }),
      /not found/i,
    );
  });
});

// ─── Direction selection ──────────────────────────────────────────────────────

describe("DiscoveryOrchestrator.selectDirection", () => {
  test("sets selectedSolutionId on the session", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need to automate our invoice approval process for the finance team.",
    );

    const firstSolution = session.solutionOptions[0];
    const updated = await orchestrator.selectDirection({
      sessionId: session.id,
      solutionId: firstSolution.id,
    });

    assert.equal(updated.selectedSolutionId, firstSolution.id);
  });

  test("transitions status to direction_selected", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need to automate our invoice approval process for the finance team.",
    );

    const updated = await orchestrator.selectDirection({
      sessionId: session.id,
      solutionId: session.solutionOptions[0].id,
    });

    assert.equal(updated.status, "direction_selected");
  });

  test("is idempotent — selecting the same solution twice keeps direction_selected", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(
      orchestrator,
      "We need to automate our invoice approval process.",
    );

    const sol = session.solutionOptions[0];
    await orchestrator.selectDirection({ sessionId: session.id, solutionId: sol.id });
    const second = await orchestrator.selectDirection({ sessionId: session.id, solutionId: sol.id });

    assert.equal(second.status, "direction_selected");
    assert.equal(second.selectedSolutionId, sol.id);
  });

  test("throws for unknown solution id", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await startAndGenerate(orchestrator, "We need to build something.");

    await assert.rejects(
      () => orchestrator.selectDirection({ sessionId: session.id, solutionId: "bad_sol" }),
      /not found/i,
    );
  });

  test("throws for unknown session id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(
      () => orchestrator.selectDirection({ sessionId: "nope", solutionId: "s1" }),
      /not found/i,
    );
  });
});

// ─── Controller Phase 2 ───────────────────────────────────────────────────────

describe("DiscoveryController Phase 2", () => {
  test("generateSolutions delegates to orchestrator", async () => {
    const { orchestrator } = makeOrchestrator();
    const controller = new DiscoveryController(orchestrator);

    const session = await controller.startDiscovery({
      userId: "u1",
      message: "We need to automate report generation for the ops team.",
    });
    const withSolutions = await controller.generateSolutions(session.id);
    assert.ok(withSolutions.solutionOptions.length >= 1);
  });

  test("selectDirection delegates to orchestrator", async () => {
    const { orchestrator } = makeOrchestrator();
    const controller = new DiscoveryController(orchestrator);

    const session = await controller.startDiscovery({
      userId: "u1",
      message: "We need to automate report generation for the ops team.",
    });
    const withSolutions = await controller.generateSolutions(session.id);
    const sol = withSolutions.solutionOptions[0];

    const directed = await controller.selectDirection(session.id, { solutionId: sol.id });
    assert.equal(directed.selectedSolutionId, sol.id);
    assert.equal(directed.status, "direction_selected");
  });
});

// ─── End-to-end Phase 1+2 flow ────────────────────────────────────────────────

describe("End-to-end: vague ask → direction selected", () => {
  test("full happy path", async () => {
    const { orchestrator } = makeOrchestrator();

    // 1. Start
    const session = await orchestrator.startDiscovery({
      userId: "u1",
      rawMessage: "Our support team answers the same customer questions every day. It is slow and frustrating.",
    });
    assert.ok(session.intent, "intent should be set");
    assert.ok(session.problemFrame, "problem frame should be set");

    // 2. Generate solutions
    const withSolutions = await orchestrator.generateSolutions(session.id);
    assert.ok(withSolutions.solutionOptions.length >= 2, "should have solutions");

    // 3. Select direction
    const recommended = withSolutions.solutionOptions.find((s) => s.isRecommended);
    assert.ok(recommended, "should have a recommended option");

    const directed = await orchestrator.selectDirection({
      sessionId: session.id,
      solutionId: recommended.id,
    });
    assert.equal(directed.selectedSolutionId, recommended.id);
    assert.equal(directed.status, "direction_selected");

    // 4. Timeline should record the journey
    const statuses = directed.timeline.map((e) => e.status);
    assert.ok(statuses.includes("conversation_started"), "timeline should include conversation_started");
    assert.ok(statuses.includes("direction_selected"), "timeline should include direction_selected");
  });
});

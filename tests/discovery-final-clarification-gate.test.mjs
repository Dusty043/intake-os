/**
 * TASK-0075 — Discovery's sendToEvaluation runs the same clarification-
 * blocking check Intake evaluation uses (finalClarificationCheckAgent),
 * so Discovery's own confidence-score gate and Intake's isBlocking verdict
 * can't disagree. Root cause: two independently-tuned live LLM judgments
 * (Discovery confidence vs. Intake clarification-blocking) shared no
 * criterion — see TASK-0074's discoveryNotes fix, which only bridged
 * context, not the gate itself.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryDiscoverySessionStore,
  InMemoryProjectIntakeStore,
  DiscoveryOrchestrator,
  MockIntentExtractionAgent,
  MockProblemFramingAgent,
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
  MockManifestGeneratorAgent,
} from "../dist/src/index.js";

let counter = 0;
function idFactory(prefix) {
  return `${prefix}_gate_${++counter}`;
}
function fixedNow() {
  return "2026-07-17T00:00:00.000Z";
}

function stubCheckAgent(output) {
  return {
    role: "clarification_questions",
    run: async () => output,
  };
}

function capturingCheckAgent(output) {
  let capturedCtx = null;
  return {
    agent: {
      role: "clarification_questions",
      run: async (ctx) => {
        capturedCtx = ctx;
        return output;
      },
    },
    getCtx: () => capturedCtx,
  };
}

function makeOrchestrator(finalClarificationCheckAgent) {
  const store = new InMemoryDiscoverySessionStore();
  const intakeStore = new InMemoryProjectIntakeStore();
  const orchestrator = new DiscoveryOrchestrator(
    store,
    new MockIntentExtractionAgent(),
    new MockProblemFramingAgent(),
    new MockSolutionGenerationAgent(),
    new MockClarificationAgent(),
    new MockProposalComposerAgent(),
    new MockManifestGeneratorAgent(),
    { idFactory, now: fixedNow, intakeStore, finalClarificationCheckAgent },
  );
  return { store, intakeStore, orchestrator };
}

async function startAndSelectDirection(orchestrator, message) {
  const session = await orchestrator.startDiscovery({ userId: "u1", rawMessage: message });
  const withSolutions = await orchestrator.generateSolutions(session.id);
  const recommended = withSolutions.solutionOptions.find((s) => s.isRecommended);
  return orchestrator.selectDirection({
    sessionId: session.id,
    solutionId: recommended?.id ?? withSolutions.solutionOptions[0].id,
  });
}

describe("DiscoveryOrchestrator.sendToEvaluation — final clarification gate", () => {
  test("no check agent configured — proceeds exactly as before (backward compatible)", async () => {
    const { orchestrator } = makeOrchestrator(undefined);
    const directed = await startAndSelectDirection(orchestrator, "Our support team answers the same questions daily.");
    const result = await orchestrator.sendToEvaluation(directed.id);
    assert.ok(result.intakeRecord, "intakeRecord should be created when no check agent is wired");
    assert.equal(result.session.status, "sent_to_evaluation");
  });

  test("check agent says isBlocking=false — proceeds normally", async () => {
    const agent = stubCheckAgent({
      sectionKind: "clarification_questions",
      content: { isBlocking: false, questions: [], missingFields: [] },
      confidence: 0.8,
      warnings: [],
      isClarificationBlocking: false,
    });
    const { orchestrator } = makeOrchestrator(agent);
    const directed = await startAndSelectDirection(orchestrator, "Our finance team manually approves invoices.");
    const result = await orchestrator.sendToEvaluation(directed.id);
    assert.ok(result.intakeRecord, "intakeRecord should be created when check passes");
    assert.equal(result.session.status, "sent_to_evaluation");
  });

  test("check agent says isBlocking=true — blocks handoff, no intake created, session reverts to clarification_needed", async () => {
    const agent = stubCheckAgent({
      sectionKind: "clarification_questions",
      content: {
        isBlocking: true,
        questions: [
          { id: "q1", question: "What price table should be used?", reason: "unresolved", required: true },
          { id: "q2", question: "What is the delivery target?", reason: "nice to have", required: false },
        ],
        missingFields: ["price_table"],
      },
      confidence: 0.9,
      warnings: [],
      isClarificationBlocking: true,
    });
    const { orchestrator } = makeOrchestrator(agent);
    const directed = await startAndSelectDirection(orchestrator, "Recipe cost splitter tool.");
    const result = await orchestrator.sendToEvaluation(directed.id);

    assert.equal(result.intakeRecord, undefined, "no intakeRecord should be returned when blocked");
    assert.equal(result.session.status, "clarification_needed");
    assert.equal(result.session.linkedIntakeId, undefined, "session should not be linked to an intake");

    // Discovery's own MockClarificationAgent may have already planned questions
    // during generateSolutions() — only assert on the two the check agent added.
    const questions = result.session.clarificationQuestions;
    const blocking = questions.find((q) => q.question.includes("price table"));
    const important = questions.find((q) => q.question.includes("delivery target"));
    assert.ok(blocking, "the required question from the check agent should be present");
    assert.ok(important, "the non-required question from the check agent should be present");
    assert.equal(blocking.impact, "blocking");
    assert.equal(important.impact, "important");
  });

  test("passes intake title/description to the check agent", async () => {
    const { agent, getCtx } = capturingCheckAgent({
      sectionKind: "clarification_questions",
      content: { isBlocking: false, questions: [], missingFields: [] },
      confidence: 0.8,
      warnings: [],
      isClarificationBlocking: false,
    });
    const { orchestrator } = makeOrchestrator(agent);
    const directed = await startAndSelectDirection(orchestrator, "Our onboarding checklist is tracked in a spreadsheet.");
    await orchestrator.sendToEvaluation(directed.id);

    const ctx = getCtx();
    assert.ok(ctx, "check agent should have been invoked");
    assert.ok(ctx.intake.title, "ctx.intake.title should be set");
    assert.ok(ctx.intake.description, "ctx.intake.description should be set");
  });

  test("records usage from the check agent even when it doesn't block", async () => {
    const agent = stubCheckAgent({
      sectionKind: "clarification_questions",
      content: { isBlocking: false, questions: [], missingFields: [] },
      confidence: 0.8,
      warnings: [],
      isClarificationBlocking: false,
      usage: { inputTokens: 40, outputTokens: 10, latencyMs: 120 },
    });
    const { orchestrator } = makeOrchestrator(agent);
    const directed = await startAndSelectDirection(orchestrator, "Our finance team manually approves invoices every day.");
    const result = await orchestrator.sendToEvaluation(directed.id);

    const usage = (result.session.usageRecords ?? []).find((u) => u.agentRole === "final_clarification_check");
    assert.ok(usage, "usage record for final_clarification_check should be recorded");
    assert.equal(usage.inputTokens, 40);
    assert.equal(usage.outputTokens, 10);
  });
});

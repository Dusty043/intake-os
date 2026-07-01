/**
 * Discovery Engine — AI usage/cost tracking.
 * Real (non-mock) discovery agents report token usage via opts.onUsage; the
 * orchestrator converts that into DiscoveryAgentUsageRecord[] on the session
 * so it can be aggregated into the same cost reports as intake evaluations.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryDiscoverySessionStore,
  DiscoveryOrchestrator,
  MockIntentExtractionAgent,
  MockProblemFramingAgent,
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
  MockManifestGeneratorAgent,
  emptyConfidence,
} from "../dist/src/index.js";

let counter = 0;
function idFactory(prefix) {
  return `${prefix}_test_${++counter}`;
}

function fixedNow() {
  return "2026-07-01T00:00:00.000Z";
}

class StubIntentAgent {
  async extractIntent(_ctx, opts) {
    opts.onUsage?.({ agentRole: "intent_extraction", model: "gpt-5.5", inputTokens: 100, outputTokens: 50, latencyMs: 12 });
    return {
      intentType: "software_project",
      requestedSolution: null,
      underlyingProblem: "Need an internal tool",
      solutionBiasDetected: false,
      solutionBiasNote: undefined,
      confidence: 0.7,
    };
  }
}

class StubFramingAgent {
  async frameProblem(_ctx, opts) {
    opts.onUsage?.({ agentRole: "problem_framing", model: "gpt-5.5", inputTokens: 200, outputTokens: 80, latencyMs: 20 });
    return {
      frame: {
        problemStatement: "Internal team needs a tool",
        affectedUsers: [],
        currentProcess: "manual",
        painPoints: [],
        businessImpact: "unknown",
        successCriteria: [],
        assumptions: [],
        unknowns: [],
      },
      confidence: emptyConfidence(),
    };
  }
}

function makeRealAgentOrchestrator() {
  const store = new InMemoryDiscoverySessionStore();
  const orchestrator = new DiscoveryOrchestrator(
    store,
    new StubIntentAgent(),
    new StubFramingAgent(),
    new MockSolutionGenerationAgent(),
    new MockClarificationAgent(),
    new MockProposalComposerAgent(),
    new MockManifestGeneratorAgent(),
    { provider: "openai", idFactory, now: fixedNow },
  );
  return { store, orchestrator };
}

describe("DiscoveryOrchestrator — usage tracking", () => {
  test("startDiscovery records usage emitted by real agents with provider/model/cost", async () => {
    const { orchestrator } = makeRealAgentOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user-1",
      rawMessage: "We need an internal tool to track something for our team",
    });

    assert.equal(session.usageRecords?.length, 2);
    const [intentUsage, framingUsage] = session.usageRecords;

    assert.equal(intentUsage.agentRole, "intent_extraction");
    assert.equal(intentUsage.provider, "openai");
    assert.equal(intentUsage.model, "gpt-5.5");
    assert.equal(intentUsage.inputTokens, 100);
    assert.equal(intentUsage.outputTokens, 50);
    assert.equal(intentUsage.totalTokens, 150);
    assert.equal(intentUsage.latencyMs, 12);
    assert.equal(intentUsage.estimatedCostUsd, 0.002);
    assert.equal(intentUsage.createdAt, fixedNow());
    assert.ok(intentUsage.id);

    assert.equal(framingUsage.agentRole, "problem_framing");
    assert.equal(framingUsage.totalTokens, 280);
    assert.equal(framingUsage.estimatedCostUsd, 0.0034);
  });

  test("usage accumulates across turns instead of being overwritten", async () => {
    const { orchestrator } = makeRealAgentOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "user-1",
      rawMessage: "We need an internal tool to track something for our team",
    });
    assert.equal(session.usageRecords?.length, 2);

    const updated = await orchestrator.addMessage({
      sessionId: session.id,
      content: "More detail about the internal workflow and the data involved",
    });
    assert.equal(updated.usageRecords?.length, 4);
  });

  test("mock agents (no live LLM call) emit no usage records", async () => {
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

    const session = await orchestrator.startDiscovery({
      userId: "user-1",
      rawMessage: "We need an internal tool",
    });
    assert.equal((session.usageRecords ?? []).length, 0);
  });
});

describe("InMemoryDiscoverySessionStore.listAllUsageRecords", () => {
  test("flattens usage records across sessions and tags sessionId", async () => {
    const store = new InMemoryDiscoverySessionStore();
    await store.create(makeSessionWithUsage("s1", [
      { id: "u1", agentRole: "intent_extraction", provider: "openai", createdAt: "2026-07-01T00:00:00.000Z", estimatedCostUsd: 0.01 },
    ]));
    await store.create(makeSessionWithUsage("s2", [
      { id: "u2", agentRole: "problem_framing", provider: "openai", createdAt: "2026-07-05T00:00:00.000Z", estimatedCostUsd: 0.02 },
    ]));

    const all = await store.listAllUsageRecords();
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((r) => r.sessionId).sort(), ["s1", "s2"]);
  });

  test("filters by startDate/endDate inclusive", async () => {
    const store = new InMemoryDiscoverySessionStore();
    await store.create(makeSessionWithUsage("s1", [
      { id: "u1", agentRole: "intent_extraction", provider: "openai", createdAt: "2026-06-15T00:00:00.000Z", estimatedCostUsd: 0.01 },
      { id: "u2", agentRole: "intent_extraction", provider: "openai", createdAt: "2026-07-15T00:00:00.000Z", estimatedCostUsd: 0.02 },
    ]));

    const julyOnly = await store.listAllUsageRecords({ startDate: "2026-07-01T00:00:00.000Z", endDate: "2026-07-31T23:59:59.999Z" });
    assert.equal(julyOnly.length, 1);
    assert.equal(julyOnly[0].id, "u2");
  });
});

function makeSessionWithUsage(id, usageRecords) {
  return {
    id,
    userId: "user-1",
    status: "conversation_started",
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
    usageRecords,
    createdAt: fixedNow(),
    updatedAt: fixedNow(),
  };
}

/**
 * DISCOVERY ENGINE - Stream Wiring Tests (T3 of Q-UX-1)
 * Verifies completeWithUsage brackets each LLM call with stage-start/token/
 * stage-end/error events, and that the orchestrator forwards them into a
 * DiscoveryStreamRegistry tagged with the correct session ID.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  completeWithUsage,
  DiscoveryStreamRegistry,
  DiscoveryOrchestrator,
  InMemoryDiscoverySessionStore,
  OpenAIIntentExtractionAgent,
  MockProblemFramingAgent,
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
  MockManifestGeneratorAgent,
} from "../dist/src/index.js";

function fixedNow() {
  return "2026-07-10T00:00:00.000Z";
}

// ─── completeWithUsage bracketing ───────────────────────────────────────────

describe("completeWithUsage — stream event bracketing", () => {
  const fakeSuccessClient = {
    provider: "mock",
    async completeStructured(params) {
      params.onToken?.("chunk-1");
      params.onToken?.("chunk-2");
      return { content: { ok: true }, inputTokens: 10, outputTokens: 5, finishReason: "stop" };
    },
  };

  const fakeFailingClient = {
    provider: "mock",
    async completeStructured() {
      throw new Error("upstream provider error");
    },
  };

  test("emits stage-start, then a token per chunk, then stage-end on success", async () => {
    const events = [];
    const opts = {
      provider: "mock",
      idFactory: (p) => `${p}-1`,
      now: fixedNow(),
      onStreamEvent: (e) => events.push(e),
    };

    await completeWithUsage(fakeSuccessClient, opts, "intent_extraction", "gpt-test", {
      systemPrompt: "sys",
      userPrompt: "user",
      schemaName: "test_schema",
      schema: {},
    });

    assert.deepEqual(
      events.map((e) => e.type),
      ["stage-start", "token", "token", "stage-end"],
    );
    assert.equal(events[0].stage, "intent_extraction");
    assert.equal(events[1].text, "chunk-1");
    assert.equal(events[2].text, "chunk-2");
  });

  test("emits stage-start then error (no stage-end) when the call throws", async () => {
    const events = [];
    const opts = {
      provider: "mock",
      idFactory: (p) => `${p}-1`,
      now: fixedNow(),
      onStreamEvent: (e) => events.push(e),
    };

    await assert.rejects(
      () =>
        completeWithUsage(fakeFailingClient, opts, "problem_framing", "gpt-test", {
          systemPrompt: "sys",
          userPrompt: "user",
          schemaName: "test_schema",
          schema: {},
        }),
      /upstream provider error/,
    );

    assert.deepEqual(
      events.map((e) => e.type),
      ["stage-start", "error"],
    );
    assert.equal(events[1].message, "upstream provider error");
  });

  test("works exactly as before when onStreamEvent is omitted (backward compat)", async () => {
    const opts = {
      provider: "mock",
      idFactory: (p) => `${p}-1`,
      now: fixedNow(),
    };

    const result = await completeWithUsage(fakeSuccessClient, opts, "intent_extraction", "gpt-test", {
      systemPrompt: "sys",
      userPrompt: "user",
      schemaName: "test_schema",
      schema: {},
    });

    assert.deepEqual(result, { ok: true });
  });
});

// ─── Orchestrator → DiscoveryStreamRegistry wiring ──────────────────────────

describe("DiscoveryOrchestrator — forwards stage events into the stream registry", () => {
  test("startDiscovery publishes intent_extraction and problem_framing events tagged with the session ID", async () => {
    const registry = new DiscoveryStreamRegistry();
    const store = new InMemoryDiscoverySessionStore();

    const fakeStreamingLlmClient = {
      provider: "mock",
      async completeStructured(params) {
        params.onToken?.('{"intentType":"soft');
        params.onToken?.('ware_project"...}');
        return {
          content: {
            intentType: "software_project",
            requestedSolution: null,
            underlyingProblem: "test problem",
            solutionBiasDetected: false,
            solutionBiasNote: null,
            confidence: 0.8,
          },
          inputTokens: 20,
          outputTokens: 8,
          finishReason: "stop",
        };
      },
    };

    let seq = 0;
    const idFactory = (prefix) => `${prefix}-${++seq}`;

    const orchestrator = new DiscoveryOrchestrator(
      store,
      new OpenAIIntentExtractionAgent(fakeStreamingLlmClient, "gpt-test"),
      new MockProblemFramingAgent(),
      new MockSolutionGenerationAgent(),
      new MockClarificationAgent(),
      new MockProposalComposerAgent(),
      new MockManifestGeneratorAgent(),
      { provider: "openai", idFactory, now: fixedNow, streamRegistry: registry },
    );

    // idFactory is deterministic and this is the first ID it will mint —
    // subscribe before the session exists so we catch every event live.
    const predictedSessionId = "discovery-1";
    const events = [];
    registry.subscribe(predictedSessionId, (e) => events.push(e));

    await orchestrator.startDiscovery({ userId: "user-1", rawMessage: "I need a tool for X" });

    const intentEvents = events.filter((e) => e.stage === "intent_extraction");
    assert.deepEqual(
      intentEvents.map((e) => e.type),
      ["stage-start", "token", "token", "stage-end"],
    );
    assert.equal(intentEvents[1].text, '{"intentType":"soft');

    // problem_framing runs via the real (non-mock) mock agent path in this
    // orchestrator's Mock* agents — those don't call completeWithUsage at
    // all, so no stream events are expected for stages backed by mocks.
    assert.equal(events.some((e) => e.stage === "problem_framing"), false);
  });

  test("publish is a no-op when no streamRegistry is configured (existing behavior unaffected)", async () => {
    const store = new InMemoryDiscoverySessionStore();
    let seq = 0;
    const orchestrator = new DiscoveryOrchestrator(
      store,
      new OpenAIIntentExtractionAgent(
        {
          provider: "mock",
          async completeStructured() {
            return {
              content: {
                intentType: "software_project",
                requestedSolution: null,
                underlyingProblem: "test problem",
                solutionBiasDetected: false,
                solutionBiasNote: null,
                confidence: 0.8,
              },
              inputTokens: 1,
              outputTokens: 1,
              finishReason: "stop",
            };
          },
        },
        "gpt-test",
      ),
      new MockProblemFramingAgent(),
      new MockSolutionGenerationAgent(),
      new MockClarificationAgent(),
      new MockProposalComposerAgent(),
      new MockManifestGeneratorAgent(),
      { provider: "openai", idFactory: (p) => `${p}-${++seq}`, now: fixedNow },
    );

    const session = await orchestrator.startDiscovery({ userId: "user-1", rawMessage: "test" });
    assert.ok(session.id);
  });
});

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import {
  InMemoryDiscoverySessionStore,
  EvaluationOrchestrator,
  PhaseZeroPacketService,
  PHASE_ZERO_DOCUMENT_SPECS,
  buildPhaseZeroPacket,
  buildPhaseZeroZip,
  capturePhaseZeroSource,
  createAllMockEvaluationAgents,
  emptyConfidence,
  emptyProjectProposal,
  proposalToIntakeRecord,
} from "../dist/src/index.js";
import { OpenAICustomBuildAgent } from "../dist/src/application/agents/openai/openai-custom-build-agent.js";

const NOW = "2026-07-31T00:00:00.000Z";

function makeSession(confidence = 0.9) {
  const proposal = emptyProjectProposal("proposal-1", "discovery-1", NOW);
  proposal.title = "Customer <script> Portal";
  proposal.status = "complete";
  proposal.selectedSolutionId = "solution-1";
  proposal.assumptions = [{ assumption: "Internal users only", rationale: "No external audience was named" }];
  proposal.unknowns = ["Final retention period"];
  proposal.suggestedEpics = ["Foundation", "Delivery"];
  proposal.suggestedTasks = ["Build the primary workflow"];
  proposal.requirements = {
    value: {
      functional: ["Users can complete the primary workflow"],
      nonFunctional: { performance: null, scale: null, reliability: null, security: null, maintainability: null, compliance: null },
    },
    confidence,
    source: "inferred",
  };
  return {
    id: "discovery-1",
    userId: "user-1",
    status: "direction_selected",
    messages: [{ id: "message-1", role: "user", content: "Build a customer portal", createdAt: NOW }],
    timeline: [],
    intent: null,
    problemFrame: {
      problemStatement: "Customers need a clear self-service workflow.",
      affectedUsers: ["Customer"],
      currentProcess: "Manual email",
      painPoints: ["Slow response"],
      businessImpact: "Lower support load",
      successCriteria: ["Customers complete requests without support"],
      assumptions: [],
      unknowns: [],
    },
    solutionOptions: [{
      id: "solution-1",
      title: "Customer portal",
      summary: "A focused self-service portal",
      whenItFits: "Customers need repeatable access",
      whenItIsWrong: "The process is truly one-off",
      complexity: "medium",
      dependencies: ["Identity provider"],
      risks: [],
      expectedUpside: "Faster service",
      rank: 1,
      isRecommended: true,
    }],
    clarificationQuestions: [],
    selectedSolutionId: "solution-1",
    proposal,
    manifest: null,
    linkedIntakeId: "intake-1",
    confidence: Object.fromEntries(Object.keys(emptyConfidence()).map((key) => [key, confidence])),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeEvaluation(score = 95) {
  return {
    id: "evaluation-1",
    intakeId: "intake-1",
    depth: "full",
    sections: [],
    qualityScore: {
      dimensions: { completeness: score, consistency: score, specificity: score, feasibility: score, riskCoverage: score, handoffReadiness: score },
      overall: score,
      readinessBand: score >= 90 ? "ready" : "usable",
    },
    status: "ready_for_review",
    evaluationVersion: 1,
    createdAt: NOW,
    createdBy: { id: "discovery-engine", role: "intake_owner" },
  };
}

describe("Phase 0 packet", () => {
  test("builds the complete static tree, escapes SVG text, and produces a readable ZIP", () => {
    const source = capturePhaseZeroSource(makeSession(), NOW);
    const packet = buildPhaseZeroPacket(source, makeEvaluation(), NOW);

    assert.equal(packet.state, "ready");
    assert.equal(packet.documents.length, PHASE_ZERO_DOCUMENT_SPECS.length);
    assert.ok(packet.documents.every((document) => document.content.trim() && document.sha256.length === 64));
    const wireframe = packet.documents.find((document) => document.id === "wireframes");
    assert.match(wireframe.content, /Customer &lt;script&gt; Portal/);
    assert.doesNotMatch(wireframe.content, /Customer <script>/);

    const files = unzipSync(buildPhaseZeroZip(packet));
    assert.equal(Object.keys(files).length, PHASE_ZERO_DOCUMENT_SPECS.length + 1);
    assert.equal(JSON.parse(strFromU8(files["PACKET-MANIFEST.json"])).state, "ready");
    assert.match(strFromU8(files["00 Executive Summary/Executive Summary.md"]), /unapproved Phase 0/i);
  });

  test("keeps low-scoring but complete packets downloadable with warnings", () => {
    const packet = buildPhaseZeroPacket(capturePhaseZeroSource(makeSession(), NOW), makeEvaluation(70), NOW);
    assert.equal(packet.state, "ready_with_warnings");
    assert.ok(buildPhaseZeroZip(packet).byteLength > 0);
  });

  test("full evaluation records clarification gaps without blocking the packet", async () => {
    const session = makeSession();
    const intake = proposalToIntakeRecord(session.proposal, session, (prefix) => `${prefix}-1`, NOW);
    const agents = createAllMockEvaluationAgents().map((agent) => agent.role === "clarification_questions"
      ? {
          role: "clarification_questions",
          run: async () => ({
            sectionKind: "clarification_questions",
            content: {
              isBlocking: true,
              questions: [{ id: "q1", question: "What is the final retention period?", reason: "Security design", required: true }],
              missingFields: ["retention period"],
            },
            confidence: 0.8,
            warnings: [],
            isClarificationBlocking: true,
          }),
        }
      : agent);
    const orchestrator = new EvaluationOrchestrator({ agents, idFactory: (prefix) => `${prefix}-${Math.random()}`, now: () => NOW });

    const result = await orchestrator.orchestrate(intake, {
      actor: { id: "user-1", role: "intake_owner" },
      depth: "full",
      provider: "mock",
      allowClarificationBlocking: false,
      discoveryNotes: [JSON.stringify(capturePhaseZeroSource(session, NOW))],
    });

    assert.equal(result.kind, "evaluation_ready");
    assert.ok(result.evaluation.sections.some((section) => section.kind === "clarification_questions"));
    assert.ok(!result.evaluation.sections.some((section) => section.kind === "distribution_plan"));
  });
});

describe("PhaseZeroPacketService", () => {
  test("waits below 80%, supports force, and is idempotent once ready", async () => {
    const store = new InMemoryDiscoverySessionStore();
    await store.create(makeSession(0.7));
    let handoffs = 0;
    const discovery = {
      composeProposal: async () => store.getById("discovery-1"),
      sendToEvaluation: async () => {
        handoffs += 1;
        return { session: await store.getById("discovery-1"), intakeRecord: { id: "intake-1" } };
      },
    };
    const workflow = {
      getLatestEvaluationForIntake: async () => ({ evaluation: makeEvaluation(), agentRuns: [] }),
      generateEvaluation: async () => { throw new Error("should reuse full evaluation"); },
    };
    const service = new PhaseZeroPacketService(discovery, store, workflow, { provider: "mock", now: () => NOW });

    assert.equal((await service.queue("discovery-1")).phaseZeroPacket, undefined);
    assert.equal(handoffs, 0);
    await service.queue("discovery-1", true);
    await waitFor(async () => ["ready", "ready_with_warnings"].includes((await store.getById("discovery-1")).phaseZeroPacket?.state));
    assert.equal(handoffs, 1);
    await service.queue("discovery-1", true);
    assert.equal(handoffs, 1);
  });

  test("does not expose raw provider output when generation fails", async () => {
    const store = new InMemoryDiscoverySessionStore();
    await store.create(makeSession());
    const service = new PhaseZeroPacketService({
      composeProposal: async () => store.getById("discovery-1"),
      sendToEvaluation: async () => ({ session: await store.getById("discovery-1"), intakeRecord: { id: "intake-1" } }),
    }, store, {
      getLatestEvaluationForIntake: async () => ({ evaluation: null, agentRuns: [] }),
      generateEvaluation: async () => { throw new Error("secret partial JSON from provider"); },
    }, { provider: "openai", now: () => NOW });

    await service.queue("discovery-1", true);
    await waitFor(async () => (await store.getById("discovery-1")).phaseZeroPacket?.state === "failed");
    const packet = (await store.getById("discovery-1")).phaseZeroPacket;
    assert.equal(packet.error, "The evaluator could not complete this packet. Retry generation to continue.");
    assert.doesNotMatch(packet.error, /secret partial JSON/);
  });
});

test("custom build reserves completion headroom for reasoning models", async () => {
  let maxTokens;
  const agent = new OpenAICustomBuildAgent({
    completeStructured: async (params) => {
      maxTokens = params.maxTokens;
      return {
        content: { required: true, rationale: "Custom code is required.", backendNeeds: [], frontendNeeds: [], integrationNeeds: [], infrastructureNeeds: [] },
        inputTokens: 10,
        outputTokens: 10,
        finishReason: "stop",
      };
    },
  }, "gpt-5.6-sol");

  await agent.run({ intake: { title: "Benchmark platform", description: "Run and compare model benchmarks." }, depth: "full", sections: {} }, {
    actor: { id: "user-1", role: "intake_owner" },
    provider: "openai",
    idFactory: (prefix) => `${prefix}-1`,
    now: NOW,
  });

  assert.equal(maxTokens, 16000);
});

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("condition was not reached");
}

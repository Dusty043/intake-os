/**
 * Each OpenAI discovery agent must report token usage via opts.onUsage after
 * its LLM call, so the orchestrator can log cost for admin reporting.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  OpenAIIntentExtractionAgent,
  OpenAIProblemFramingAgent,
  OpenAISolutionGenerationAgent,
  OpenAIClarificationAgent,
  OpenAIProposalComposerAgent,
  emptyConfidence,
} from "../dist/src/index.js";

function stubClient(content) {
  return {
    provider: "openai",
    completeStructured: async () => ({ content, inputTokens: 80, outputTokens: 40, finishReason: "stop" }),
  };
}

function baseOpts(events) {
  return {
    provider: "openai",
    idFactory: (prefix) => `${prefix}-1`,
    now: "2026-07-01T00:00:00.000Z",
    onUsage: (u) => events.push(u),
  };
}

const emptyCtx = () => ({ messages: [], intent: null, problemFrame: null, currentConfidence: emptyConfidence() });

describe("OpenAI discovery agents — usage reporting", () => {
  test("OpenAIIntentExtractionAgent reports usage with agentRole intent_extraction", async () => {
    const events = [];
    const agent = new OpenAIIntentExtractionAgent(
      stubClient({
        intentType: "software_project",
        requestedSolution: null,
        underlyingProblem: "x",
        solutionBiasDetected: false,
        solutionBiasNote: null,
        confidence: 0.5,
      }),
      "gpt-5.5",
    );

    await agent.extractIntent(emptyCtx(), baseOpts(events));

    assert.equal(events.length, 1);
    assert.equal(events[0].agentRole, "intent_extraction");
    assert.equal(events[0].model, "gpt-5.5");
    assert.equal(events[0].inputTokens, 80);
    assert.equal(events[0].outputTokens, 40);
    assert.equal(typeof events[0].latencyMs, "number");
  });

  test("OpenAIProblemFramingAgent reports usage with agentRole problem_framing", async () => {
    const events = [];
    const agent = new OpenAIProblemFramingAgent(
      stubClient({
        problemStatement: "x",
        affectedUsers: [],
        currentProcess: "x",
        painPoints: [],
        businessImpact: "x",
        successCriteria: [],
        assumptions: [],
        unknowns: [],
        confidence: {
          problemUnderstanding: 0.5,
          solutionFit: 0.5,
          scopeClarity: 0.5,
          technicalFeasibility: 0.5,
          stakeholderClarity: 0.5,
          downstreamMapping: 0.5,
        },
      }),
      "gpt-5.5",
    );

    await agent.frameProblem(emptyCtx(), baseOpts(events));

    assert.equal(events.length, 1);
    assert.equal(events[0].agentRole, "problem_framing");
    assert.equal(events[0].model, "gpt-5.5");
  });

  test("OpenAISolutionGenerationAgent reports usage with agentRole solution_generation", async () => {
    const events = [];
    const agent = new OpenAISolutionGenerationAgent(stubClient({ solutions: [] }), "gpt-5.5");

    await agent.generateSolutions(emptyCtx(), baseOpts(events));

    assert.equal(events.length, 1);
    assert.equal(events[0].agentRole, "solution_generation");
  });

  test("OpenAIClarificationAgent reports usage with agentRole clarification", async () => {
    const events = [];
    const agent = new OpenAIClarificationAgent(stubClient({ questions: [] }), "gpt-5.5");

    await agent.planClarifications(emptyCtx(), baseOpts(events));

    assert.equal(events.length, 1);
    assert.equal(events[0].agentRole, "clarification");
  });

  test("OpenAIProposalComposerAgent reports usage with agentRole proposal_composition", async () => {
    const events = [];
    const agent = new OpenAIProposalComposerAgent(
      stubClient({
        title: "x",
        problemStatement: "x",
        businessContext: "x",
        successCriteria: [],
        functionalRequirements: [],
        nonFunctionalNotes: "",
        systemDesignOverview: "x",
        clientLayer: null,
        apiLayer: null,
        architectureRecommendation: "monolith",
        architectureRationale: "x",
        dataLayer: null,
        infrastructure: null,
        suggestedEpics: [],
        suggestedTasks: [],
        assumptions: [],
        unknowns: [],
        status: "draft",
      }),
      "gpt-5.5",
    );

    const session = {
      id: "sess-1",
      messages: [],
      solutionOptions: [],
      selectedSolutionId: null,
      clarificationQuestions: [],
      problemFrame: null,
    };

    await agent.composeProposal(session, baseOpts(events));

    assert.equal(events.length, 1);
    assert.equal(events[0].agentRole, "proposal_composition");
  });

  test("onUsage is optional — agents do not throw when it is omitted", async () => {
    const agent = new OpenAIIntentExtractionAgent(
      stubClient({
        intentType: "software_project",
        requestedSolution: null,
        underlyingProblem: "x",
        solutionBiasDetected: false,
        solutionBiasNote: null,
        confidence: 0.5,
      }),
      "gpt-5.5",
    );

    const result = await agent.extractIntent(emptyCtx(), {
      provider: "openai",
      idFactory: (p) => `${p}-1`,
      now: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(result.intentType, "software_project");
  });
});

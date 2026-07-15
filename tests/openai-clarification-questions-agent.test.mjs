/**
 * Root cause of "discovery is broken — pushback existed in the intake not
 * discovery, doesn't create ai draft properly": OpenAIClarificationQuestionsAgent
 * never read ctx.priorClarifications, unlike MockClarificationQuestionsAgent,
 * which explicitly treats prior discovery answers as resolving blocking
 * questions. Discovery-originated intakes got re-blocked at the evaluation
 * stage in production (real OpenAI agents), and blocking short-circuits the
 * orchestrator before any draft is generated.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIClarificationQuestionsAgent } from "../dist/src/application/agents/openai/openai-clarification-questions-agent.js";

function stubClient(content) {
  return {
    completeStructured: async () => ({ content, inputTokens: 50, outputTokens: 20, finishReason: "stop" }),
  };
}

function baseCtx(overrides = {}) {
  return {
    intake: { title: "Sales dashboard", description: "Internal dashboard for sales KPIs." },
    depth: "standard",
    sections: {},
    ...overrides,
  };
}

const baseOpts = { provider: "openai", idFactory: (p) => `${p}-1`, now: "2026-07-16T00:00:00.000Z" };

describe("OpenAIClarificationQuestionsAgent", () => {
  test("passes through isBlocking=true when there are no prior clarifications", async () => {
    const agent = new OpenAIClarificationQuestionsAgent(
      stubClient({ isBlocking: true, questions: [], missingFields: ["tech_stack"] }),
      "gpt-5.6-terra",
    );
    const output = await agent.run(baseCtx(), baseOpts);
    assert.equal(output.content.isBlocking, true);
  });

  test("forces isBlocking=false when priorClarifications already exist, even if the model says true", async () => {
    const agent = new OpenAIClarificationQuestionsAgent(
      stubClient({ isBlocking: true, questions: [{ id: "q1", question: "x", reason: "y", required: true }], missingFields: ["tech_stack"] }),
      "gpt-5.6-terra",
    );
    const ctx = baseCtx({
      priorClarifications: [{ question: "What tech stack?", answer: "Next.js and Postgres" }],
    });
    const output = await agent.run(ctx, baseOpts);
    assert.equal(output.content.isBlocking, false);
    assert.equal(output.isClarificationBlocking, false);
  });

  test("includes prior clarification Q&A pairs in the prompt sent to the model", async () => {
    let capturedPrompt = null;
    const client = {
      completeStructured: async (args) => {
        capturedPrompt = args.userPrompt;
        return { content: { isBlocking: false, questions: [], missingFields: [] }, inputTokens: 10, outputTokens: 5, finishReason: "stop" };
      },
    };
    const agent = new OpenAIClarificationQuestionsAgent(client, "gpt-5.6-terra");
    const ctx = baseCtx({
      priorClarifications: [{ question: "What tech stack?", answer: "Next.js and Postgres" }],
    });
    await agent.run(ctx, baseOpts);
    assert.ok(capturedPrompt.includes("Next.js and Postgres"));
  });
});

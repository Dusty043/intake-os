/**
 * TASK-0076 — proposalToIntakeRecord previously dropped proposal.assumptions
 * entirely; only proposal.unknowns reached Intake's discovery.notes. Since
 * assumptions are things discovery guessed on the user's behalf without
 * confirmation (unlike unknowns, which carry a recommended default), they
 * need to reach Intake's clarification agent (TASK-0074) and the final
 * clarification-check gate (TASK-0075) — labeled distinctly so the model
 * knows to actively confirm them rather than wave them through.
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
  proposalToIntakeRecord,
} from "../dist/src/index.js";

let counter = 0;
function idFactory(prefix) {
  return `${prefix}_pia_${++counter}`;
}
function fixedNow() {
  return "2026-07-17T00:00:00.000Z";
}

function makeOrchestrator() {
  const store = new InMemoryDiscoverySessionStore();
  return new DiscoveryOrchestrator(
    store,
    new MockIntentExtractionAgent(),
    new MockProblemFramingAgent(),
    new MockSolutionGenerationAgent(),
    new MockClarificationAgent(),
    new MockProposalComposerAgent(),
    new MockManifestGeneratorAgent(),
    { idFactory, now: fixedNow },
  );
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

describe("proposalToIntakeRecord — assumptions surfaced to Intake", () => {
  test("includes assumptions in discovery.notes, labeled separately from unknowns", async () => {
    const orchestrator = makeOrchestrator();
    const directed = await startAndSelectDirection(orchestrator, "We need an internal tool for something.");
    const session = await orchestrator.composeProposal(directed.id);

    const proposal = {
      ...session.proposal,
      unknowns: ["What is the expected user count?"],
      assumptions: [{
        assumption: "This is for internal staff only, not external customers.",
        rationale: "The request came through the internal AI & Automation team channel with no mention of external users.",
      }],
    };

    const record = proposalToIntakeRecord(proposal, session, idFactory, fixedNow());

    assert.ok(record.discovery.notes.includes("Open unknowns from discovery:"));
    assert.ok(record.discovery.notes.includes("expected user count"));
    assert.ok(record.discovery.notes.includes("Unconfirmed assumptions discovery made without asking the user:"));
    assert.ok(record.discovery.notes.includes("internal staff only"));
    assert.ok(record.discovery.notes.includes("Rationale:"));
    assert.ok(record.discovery.notes.includes("AI & Automation team channel"));
  });

  test("notes is undefined when there are neither unknowns nor assumptions", async () => {
    const orchestrator = makeOrchestrator();
    const directed = await startAndSelectDirection(orchestrator, "We need an internal tool for something.");
    const session = await orchestrator.composeProposal(directed.id);

    const proposal = { ...session.proposal, unknowns: [], assumptions: [] };
    const record = proposalToIntakeRecord(proposal, session, idFactory, fixedNow());
    assert.equal(record.discovery.notes, undefined);
  });

  test("includes only assumptions when there are no unknowns", async () => {
    const orchestrator = makeOrchestrator();
    const directed = await startAndSelectDirection(orchestrator, "We need an internal tool for something.");
    const session = await orchestrator.composeProposal(directed.id);

    const proposal = {
      ...session.proposal,
      unknowns: [],
      assumptions: [{
        assumption: "This is a web app, not mobile.",
        rationale: "No platform preference was stated and the conversation described browser-based usage.",
      }],
    };
    const record = proposalToIntakeRecord(proposal, session, idFactory, fixedNow());
    assert.ok(!record.discovery.notes.includes("Open unknowns from discovery:"));
    assert.ok(record.discovery.notes.includes("Unconfirmed assumptions discovery made without asking the user:"));
    assert.ok(record.discovery.notes.includes("web app, not mobile"));
    assert.ok(record.discovery.notes.includes("Rationale:"));
  });
});

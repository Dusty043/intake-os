/**
 * DISCOVERY ENGINE - Phase 3 Tests
 * Proposal composition, completeness gate, intake adapter, sendToEvaluation.
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
  MockManifestGeneratorAgent,
  proposalToIntakeRecord,
  emptyConfidence,
  emptyProjectProposal,
  ValidationError,
} from "../dist/src/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let counter = 0;
function idFactory(prefix) {
  return `${prefix}_p3_${++counter}`;
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

async function startAndSelectDirection(orchestrator, message) {
  const session = await orchestrator.startDiscovery({ userId: "u1", rawMessage: message });
  const withSolutions = await orchestrator.generateSolutions(session.id);
  const recommended = withSolutions.solutionOptions.find((s) => s.isRecommended);
  return orchestrator.selectDirection({
    sessionId: session.id,
    solutionId: recommended?.id ?? withSolutions.solutionOptions[0].id,
  });
}

// ─── MockProposalComposerAgent — unit tests ────────────────────────────────────

describe("MockProposalComposerAgent — proposal shape", () => {
  test("returns a proposal with an id and discoverySessionId", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team answers the same customer questions every day.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    assert.ok(session.proposal, "proposal should be set on session");
    assert.ok(session.proposal.id, "proposal must have an id");
    assert.equal(session.proposal.discoverySessionId, directed.id);
  });

  test("proposal title is derived from selected solution", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "We need to automate our invoice approval process.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    assert.ok(session.proposal.title.length > 0, "proposal title should be non-empty");
  });

  test("problemFrame slot is populated when session has a problemFrame", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our finance team manually approves every invoice which takes 3 days.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const pf = session.proposal.problemFrame;
    assert.ok(pf.value !== null, "problemFrame slot should have a value");
    assert.ok(pf.value.businessContext.length > 0, "businessContext should be non-empty");
    assert.ok(Array.isArray(pf.value.successMatrix), "successMatrix should be array");
    assert.ok(pf.confidence > 0, "problemFrame confidence should be > 0");
  });

  test("requirements slot includes functional requirements from selected solution", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Support keeps answering the same questions every day.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const req = session.proposal.requirements;
    assert.ok(req.value !== null, "requirements slot should have a value");
    assert.ok(req.value.functional.length >= 1, "should have at least one functional requirement");
    assert.ok(typeof req.value.nonFunctional === "object", "nonFunctional should be an object");
  });

  test("systemDesign slot is populated", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "We need to automate our invoice approval process for the finance team.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const sd = session.proposal.systemDesign;
    assert.ok(sd.value !== null, "systemDesign slot should have a value");
    assert.ok(sd.value.highLevelOverview.length > 0, "highLevelOverview should be non-empty");
    assert.ok(
      ["monolith", "microservices", "hybrid", "undetermined"].includes(
        sd.value.serviceArchitecture.recommendation,
      ),
      "serviceArchitecture.recommendation must be a valid value",
    );
  });

  test("suggestedEpics is non-empty", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "We need to automate our report generation.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    assert.ok(session.proposal.suggestedEpics.length >= 1, "suggestedEpics should be non-empty");
  });

  test("tradeoffs slot populated when multiple solution options exist", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "We need to automate our invoice approval process.",
    );
    const withSols = await orchestrator.getSession(directed.id);
    if (withSols.solutionOptions.length >= 2) {
      const session = await orchestrator.composeProposal(directed.id);
      assert.ok(session.proposal.tradeoffs.value !== null, "tradeoffs should be populated with multiple options");
      assert.ok(session.proposal.tradeoffs.value.length >= 1, "should have at least one tradeoff item");
    }
  });

  test("observability, securityDesign, documentation slots are always populated", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our dashboard takes too long to load.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    assert.ok(session.proposal.observability.value !== null, "observability should be set");
    assert.ok(session.proposal.securityDesign.value !== null, "securityDesign should be set");
    assert.ok(session.proposal.documentation.value !== null, "documentation should be set");
    assert.ok(session.proposal.documentation.value.length >= 1, "documentation should list items");
  });
});

// ─── Completeness gate ────────────────────────────────────────────────────────

describe("Proposal completeness gate", () => {
  test("proposal status is evaluation_ready when problem + requirements + epics all present", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team answers the same customer questions every day. It is slow and frustrating for everyone.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    assert.ok(
      ["evaluation_ready", "complete"].includes(session.proposal.status),
      `proposal status must be evaluation_ready or complete, got: ${session.proposal.status}`,
    );
  });

  test("emptyProjectProposal starts as draft (baseline)", () => {
    const proposal = emptyProjectProposal("p1", "ds1", fixedNow());
    assert.equal(proposal.status, "draft");
    assert.equal(proposal.problemFrame.value, null);
    assert.equal(proposal.requirements.value, null);
    assert.equal(proposal.suggestedEpics.length, 0);
  });
});

// ─── proposalToIntakeRecord adapter ──────────────────────────────────────────

describe("proposalToIntakeRecord adapter", () => {
  test("maps proposal title and description", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team answers the same questions every day.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(
      session.proposal,
      session,
      idFactory,
      fixedNow(),
    );
    assert.ok(record.title.length > 0, "title should be non-empty");
    assert.ok(record.description.length > 0, "description should be non-empty");
  });

  test("sets source.system to 'other' and includes discoverySessionId", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "We need to automate our invoice approval.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(session.proposal, session, idFactory, fixedNow());

    assert.equal(record.source.system, "other");
    assert.equal(record.source.rawPayload?.discoverySessionId, session.id);
    assert.equal(record.source.rawPayload?.origin, "discovery_engine");
  });

  test("status is 'draft'", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(orchestrator, "Invoice process is slow.");
    const session = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(session.proposal, session, idFactory, fixedNow());
    assert.equal(record.status, "draft");
  });

  test("projectType is mapped from intent type", async () => {
    const validTypes = [
      "n8n_automation", "data_sync_integration", "internal_dashboard", "internal_tool",
      "client_portal", "saas_platform", "api_service", "ai_workflow_tool",
      "discovery_research", "reporting_automation",
    ];
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "We need to automate our onboarding process.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(session.proposal, session, idFactory, fixedNow());
    assert.ok(validTypes.includes(record.projectType), `projectType '${record.projectType}' must be a valid ProjectType`);
  });

  test("discovery record is populated from session", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team answers the same questions every day from customers.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(session.proposal, session, idFactory, fixedNow());

    assert.ok(record.discovery, "discovery record should be set");
    assert.ok(record.discovery.problemStatement.length > 0, "problemStatement should be non-empty");
    assert.ok(["unknown", "low", "medium", "high"].includes(record.discovery.dataSensitivity));
    assert.ok(["unknown", "low", "medium", "high"].includes(record.discovery.estimatedComplexity));
    assert.ok(record.discovery.completedBy.id === session.userId);
  });

  test("requester matches session userId", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(orchestrator, "Invoice approval is slow.");
    const session = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(session.proposal, session, idFactory, fixedNow());
    assert.equal(record.requester, "u1");
  });

  test("externalLinks is an empty array", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(orchestrator, "Invoice approval is slow.");
    const session = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(session.proposal, session, idFactory, fixedNow());
    assert.ok(Array.isArray(record.externalLinks));
    assert.equal(record.externalLinks.length, 0);
  });

  test("priorClarifications mapped from answered questions", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "u1",
      rawMessage: "Our invoices take too long to process and the team is frustrated.",
    });
    const withSolutions = await orchestrator.generateSolutions(session.id);

    let directed;
    if (withSolutions.clarificationQuestions.length > 0) {
      const q = withSolutions.clarificationQuestions[0];
      await orchestrator.answerClarification({
        sessionId: session.id,
        questionId: q.id,
        answer: "About 5 people in the finance department",
      });
    }
    const finalSession = await orchestrator.generateSolutions(session.id);
    const sol = finalSession.solutionOptions[0];
    directed = await orchestrator.selectDirection({ sessionId: session.id, solutionId: sol.id });

    const composed = await orchestrator.composeProposal(directed.id);
    const record = proposalToIntakeRecord(composed.proposal, composed, idFactory, fixedNow());

    const answeredQuestions = composed.clarificationQuestions.filter((q) => q.answered);
    if (answeredQuestions.length > 0) {
      assert.ok(Array.isArray(record.priorClarifications), "priorClarifications should be set");
      assert.equal(record.priorClarifications.length, answeredQuestions.length);
      for (const pc of record.priorClarifications) {
        assert.ok(pc.question.length > 0, "question text should be non-empty");
        assert.ok(pc.answer.length > 0, "answer text should be non-empty");
      }
    }
  });
});

// ─── orchestrator.composeProposal ─────────────────────────────────────────────

describe("DiscoveryOrchestrator.composeProposal", () => {
  test("stores proposal on session", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team answers the same customer questions every day.",
    );
    assert.equal(directed.proposal, null, "proposal should be null before composeProposal");

    const session = await orchestrator.composeProposal(directed.id);
    assert.ok(session.proposal !== null, "proposal should be set after composeProposal");
  });

  test("transitions status to proposal_generated or evaluation_ready", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our invoices take too long to approve. The finance team manually processes everything.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    assert.ok(
      ["proposal_generated", "evaluation_ready"].includes(session.status),
      `unexpected status: ${session.status}`,
    );
  });

  test("throws if no solution selected", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "u1",
      rawMessage: "Something is slow.",
    });
    await assert.rejects(
      () => orchestrator.composeProposal(session.id),
      /no solution selected/i,
    );
  });

  // TASK-0040: invalid-state cases now throw the application's ValidationError (mapped to a
  // clean 400 by the API's exception filter) instead of a raw Error (generic 500).
  test("throws ValidationError, not a generic Error, when no solution is selected", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({
      userId: "u1",
      rawMessage: "Something is slow.",
    });
    await assert.rejects(() => orchestrator.composeProposal(session.id), (err) => {
      assert.ok(err instanceof ValidationError, `expected ValidationError, got ${err.constructor.name}`);
      return true;
    });
  });

  test("throws for unknown session id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(
      () => orchestrator.composeProposal("nope"),
      /not found/i,
    );
  });

  test("timeline records the status transition", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team answers the same questions every day.",
    );
    const session = await orchestrator.composeProposal(directed.id);
    const statuses = session.timeline.map((e) => e.status);
    assert.ok(
      statuses.includes("proposal_generated") || statuses.includes("evaluation_ready"),
      "timeline should record proposal_generated or evaluation_ready",
    );
  });
});

// ─── orchestrator.sendToEvaluation ────────────────────────────────────────────

describe("DiscoveryOrchestrator.sendToEvaluation", () => {
  test("returns session and intakeRecord", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team answers the same customer questions every day.",
    );
    const result = await orchestrator.sendToEvaluation(directed.id);
    assert.ok(result.session, "result should have session");
    assert.ok(result.intakeRecord, "result should have intakeRecord");
  });

  test("session status transitions to sent_to_evaluation", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our finance team manually approves invoices.",
    );
    const { session } = await orchestrator.sendToEvaluation(directed.id);
    assert.equal(session.status, "sent_to_evaluation");
  });

  test("auto-composes proposal if not already done", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team is overwhelmed with repetitive questions.",
    );
    assert.equal(directed.proposal, null, "proposal should be null initially");

    const { session, intakeRecord } = await orchestrator.sendToEvaluation(directed.id);
    assert.ok(session.proposal !== null, "proposal should be auto-composed");
    assert.ok(intakeRecord.id, "intakeRecord should have id");
  });

  test("intakeRecord has correct shape", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our invoices take 3 days to approve manually.",
    );
    const { intakeRecord } = await orchestrator.sendToEvaluation(directed.id);

    assert.ok(intakeRecord.id, "intakeRecord.id must be set");
    assert.ok(intakeRecord.title, "intakeRecord.title must be set");
    assert.ok(intakeRecord.description, "intakeRecord.description must be set");
    assert.equal(intakeRecord.status, "draft");
    assert.equal(intakeRecord.requester, "u1");
    assert.ok(intakeRecord.projectType, "intakeRecord.projectType must be set");
    assert.ok(intakeRecord.discovery, "intakeRecord.discovery must be set");
    assert.ok(Array.isArray(intakeRecord.externalLinks));
  });

  test("timeline records sent_to_evaluation", async () => {
    const { orchestrator } = makeOrchestrator();
    const directed = await startAndSelectDirection(
      orchestrator,
      "Our support team manually answers the same questions.",
    );
    const { session } = await orchestrator.sendToEvaluation(directed.id);
    const statuses = session.timeline.map((e) => e.status);
    assert.ok(statuses.includes("sent_to_evaluation"), "timeline should include sent_to_evaluation");
  });

  test("throws if no solution selected", async () => {
    const { orchestrator } = makeOrchestrator();
    const session = await orchestrator.startDiscovery({ userId: "u1", rawMessage: "Test." });
    await assert.rejects(
      () => orchestrator.sendToEvaluation(session.id),
      /no solution selected/i,
    );
  });

  test("throws for unknown session id", async () => {
    const { orchestrator } = makeOrchestrator();
    await assert.rejects(
      () => orchestrator.sendToEvaluation("nope"),
      /not found/i,
    );
  });
});

// ─── Controller Phase 3 ───────────────────────────────────────────────────────

describe("DiscoveryController Phase 3", () => {
  test("composeProposal delegates to orchestrator", async () => {
    const { orchestrator } = makeOrchestrator();
    const controller = new DiscoveryController(orchestrator);

    const session = await controller.startDiscovery({
      userId: "u1",
      message: "Our support team is overwhelmed with repetitive questions every day.",
    });
    const withSolutions = await controller.generateSolutions(session.id);
    const sol = withSolutions.solutionOptions.find((s) => s.isRecommended) ?? withSolutions.solutionOptions[0];
    await controller.selectDirection(session.id, { solutionId: sol.id });

    const composed = await controller.composeProposal(session.id);
    assert.ok(composed.proposal !== null, "proposal should be set");
  });

  test("sendToEvaluation delegates to orchestrator", async () => {
    const { orchestrator } = makeOrchestrator();
    const controller = new DiscoveryController(orchestrator);

    const session = await controller.startDiscovery({
      userId: "u1",
      message: "Our invoices take 3 days to approve manually.",
    });
    const withSolutions = await controller.generateSolutions(session.id);
    const sol = withSolutions.solutionOptions[0];
    await controller.selectDirection(session.id, { solutionId: sol.id });

    const result = await controller.sendToEvaluation(session.id);
    assert.ok(result.session, "result should have session");
    assert.ok(result.intakeRecord, "result should have intakeRecord");
    assert.equal(result.session.status, "sent_to_evaluation");
  });
});

// ─── End-to-end Phase 1+2+3 flow ─────────────────────────────────────────────

describe("End-to-end: vague ask → sent to evaluation", () => {
  test("full happy path through all three phases", async () => {
    const { orchestrator } = makeOrchestrator();

    // 1. Start discovery
    const session = await orchestrator.startDiscovery({
      userId: "u1",
      rawMessage: "Our support team answers the same customer questions every day. It is slow and frustrating for customers and staff alike.",
    });
    assert.ok(session.intent, "intent should be set");
    assert.ok(session.problemFrame, "problemFrame should be set");

    // 2. Generate solutions
    const withSolutions = await orchestrator.generateSolutions(session.id);
    assert.ok(withSolutions.solutionOptions.length >= 2, "should have solutions");

    // 3. Select direction
    const recommended = withSolutions.solutionOptions.find((s) => s.isRecommended);
    const directed = await orchestrator.selectDirection({
      sessionId: session.id,
      solutionId: recommended.id,
    });
    assert.equal(directed.status, "direction_selected");

    // 4. Send to evaluation (auto-composes proposal)
    const { session: final, intakeRecord } = await orchestrator.sendToEvaluation(directed.id);
    assert.equal(final.status, "sent_to_evaluation");
    assert.ok(final.proposal !== null, "proposal should be set");
    assert.ok(intakeRecord.id, "intake record should have id");
    assert.ok(intakeRecord.title, "intake record should have title");
    assert.ok(intakeRecord.discovery, "intake record should have discovery");

    // 5. Timeline should record full journey
    const statuses = final.timeline.map((e) => e.status);
    assert.ok(statuses.includes("conversation_started"), "timeline: conversation_started");
    assert.ok(statuses.includes("direction_selected"), "timeline: direction_selected");
    assert.ok(statuses.includes("sent_to_evaluation"), "timeline: sent_to_evaluation");
  });
});

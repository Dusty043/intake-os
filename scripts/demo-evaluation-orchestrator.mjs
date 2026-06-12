// Demo: TASK-0018 Evaluation Orchestrator
// Shows the 3-stage pipeline producing a full IntakeEvaluation, then a thin
// intake returning ClarificationOutcome, and a legacy draft round-trip.

import { EvaluationOrchestrator } from "../dist/src/application/evaluation-orchestrator.js";
import { createAllMockEvaluationAgents } from "../dist/src/application/agents/mock/index.js";
import { evaluationToLegacyDraft } from "../dist/src/application/evaluation-draft-mapper.js";
import { validateIntakeAnalysisDraft } from "../dist/src/application/intake-analysis.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const ACTOR = { id: "user-demo", role: "admin", displayName: "Demo Admin" };

let _seq = 0;
const idFactory = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${String(++_seq).padStart(4, "0")}`;

function makeOrchestrator() {
  return new EvaluationOrchestrator({
    agents: createAllMockEvaluationAgents(),
    idFactory,
    now: () => new Date().toISOString(),
  });
}

// ─── Intake: full pipeline ────────────────────────────────────────────────────

const richIntake = {
  id: idFactory("INTAKE"),
  title: "Enterprise SaaS Client Portal with OAuth, Billing, and GitHub Integration",
  description:
    "Our business goal is to build a multi-tenant SaaS portal for client onboarding. Needs OAuth2 login (Google + Microsoft), Stripe billing, a React dashboard, PostgreSQL backend, GitHub API integration for repo provisioning, role-based access control, and full audit logging. Must comply with SOC 2 and GDPR. Users: enterprise clients and internal admins. Timeline: Q3 launch.",
  requester: "cto@client.com",
  department: "Engineering",
  projectType: "saas_platform",
  status: "submitted",
  createdAt: NOW,
  createdBy: ACTOR,
  source: { system: "manual" },
  externalLinks: [],
};

// ─── Demo 1: Full depth pipeline ──────────────────────────────────────────────

console.log("\n═══════════════════════════════════════");
console.log("  DEMO 1: Full-depth evaluation pipeline");
console.log("═══════════════════════════════════════\n");

const orch = makeOrchestrator();
const fullResult = await orch.orchestrate(richIntake, {
  actor: ACTOR,
  depth: "full",
  provider: "mock",
  model: "mock-v1",
});

if (fullResult.kind !== "evaluation_ready") {
  console.error("Expected evaluation_ready but got:", fullResult.kind);
  process.exit(1);
}

const { evaluation } = fullResult;

console.log("Evaluation ID     :", evaluation.id);
console.log("Intake ID         :", evaluation.intakeId);
console.log("Depth             :", evaluation.depth);
console.log("Status            :", evaluation.status);
console.log("Evaluation version:", evaluation.evaluationVersion);
console.log("Created at        :", evaluation.createdAt);
console.log("Created by        :", evaluation.createdBy.id, `(${evaluation.createdBy.role})`);
console.log("\nSections produced (in order):");
for (const section of evaluation.sections) {
  const lat = section.provenance.latencyMs !== undefined ? `${section.provenance.latencyMs}ms` : "—";
  const conf = section.provenance.confidence !== undefined ? `conf=${section.provenance.confidence}` : "";
  console.log(`  [${section.kind.padEnd(25)}]  id=${section.id}  latency=${lat}${conf ? ` | ${conf}` : ""}`);
}

if (evaluation.qualityScore) {
  console.log("\nQuality Score:");
  console.log("  overall       :", evaluation.qualityScore.overall.toFixed(1));
  console.log("  readinessBand :", evaluation.qualityScore.readinessBand);
  const dims = evaluation.qualityScore.dimensions;
  for (const [key, val] of Object.entries(dims)) {
    console.log(`  ${key.padEnd(20)}: ${val.toFixed(1)}`);
  }
}

// ─── Demo 2: Legacy draft round-trip ─────────────────────────────────────────

console.log("\n═══════════════════════════════════════");
console.log("  DEMO 2: evaluationToLegacyDraft round-trip");
console.log("═══════════════════════════════════════\n");

const draft = evaluationToLegacyDraft(evaluation, { idFactory, now: evaluation.createdAt });
const validationResult = validateIntakeAnalysisDraft(draft);

console.log("Draft ID              :", draft.id);
console.log("Source summary (first 80 chars):", draft.sourceSummary.slice(0, 80));
console.log("Estimated story points:", draft.estimatedStoryPoints);
console.log("Subtask count         :", draft.subtasks.length);
console.log("Tech stack            :", draft.recommendedTechStack.join(", "));
console.log("Legacy draft valid    :", validationResult.valid);
if (!validationResult.valid) {
  console.error("  Validation errors:", validationResult.errors);
}

// ─── Demo 3: Thin intake → clarification_required ────────────────────────────

console.log("\n═══════════════════════════════════════");
console.log("  DEMO 3: Thin intake → clarification_required");
console.log("═══════════════════════════════════════\n");

const thinIntake = {
  id: idFactory("INTAKE"),
  title: "AB",
  description: "x",
  requester: "user@example.com",
  department: "Unknown",
  projectType: "internal_tool",
  status: "submitted",
  createdAt: NOW,
  createdBy: ACTOR,
  source: { system: "manual" },
  externalLinks: [],
};

const thinResult = await orch.orchestrate(thinIntake, {
  actor: ACTOR,
  depth: "standard",
  provider: "mock",
});

if (thinResult.kind !== "clarification_required") {
  console.log("Note: thin intake did not block (heuristics may vary). Result:", thinResult.kind);
} else {
  const { clarification } = thinResult;
  console.log("Result kind       : clarification_required");
  console.log("Intake ID         :", clarification.intakeId);
  console.log("Depth             :", clarification.depth);
  console.log("Generated at      :", clarification.generatedAt);
  console.log("Missing fields    :", clarification.missingFields.join(", ") || "(none)");
  console.log("Questions count   :", clarification.questions.length);
  for (const q of clarification.questions.slice(0, 3)) {
    console.log(`  - [${q.required ? "required" : "optional"}] ${q.question}`);
  }
  if (clarification.warnings.length > 0) {
    console.log("Warnings          :", clarification.warnings.join("; "));
  }
}

console.log("\n✓ Demo complete.\n");

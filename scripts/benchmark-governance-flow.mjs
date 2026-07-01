/**
 * Governance Flow Benchmark — runs the complete mock governance pipeline in-process
 * and reports per-step timing to identify bottlenecks.
 *
 * No running API or DB required — uses InMemoryProjectIntakeStore + mock agents.
 *
 * Usage:
 *   node scripts/benchmark-governance-flow.mjs
 *   node scripts/benchmark-governance-flow.mjs --runs=5   # average over N runs
 */

import {
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
  EvaluationOrchestrator,
  InMemoryDiscoverySessionStore,
  DiscoveryOrchestrator,
  createAllMockEvaluationAgents,
  evaluationToLegacyDraft,
  createAllMockEvaluationAgents as mkAgents,
} from "../dist/src/index.js";

// ─── Config ────────────────────────────────────────────────────────────────────

const RUNS = (() => {
  const m = process.argv.find((a) => a.startsWith("--runs="));
  return m ? parseInt(m.split("=")[1], 10) : 1;
})();

const ACTORS = {
  creator:    { id: "bench-creator",    role: "request_creator", displayName: "Creator" },
  owner:      { id: "bench-owner",      role: "intake_owner",    displayName: "Intake Owner" },
  devops:     { id: "bench-devops",     role: "devops_lead",     displayName: "DevOps Lead" },
};

let _seq = 0;
const idFactory = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${String(++_seq).padStart(4, "0")}`;

// ─── Timer utility ─────────────────────────────────────────────────────────────

function lap(label, startMs) {
  const ms = performance.now() - startMs;
  return { label, ms: +ms.toFixed(2) };
}

// ─── Single governance run ────────────────────────────────────────────────────

async function runGovernanceFlow(runIndex) {
  const timings = [];
  const issues = [];

  const store = new InMemoryProjectIntakeStore();
  const service = new IntakeWorkflowService({
    store,
    clock: () => new Date().toISOString(),
    idFactory,
  });
  const orch = new EvaluationOrchestrator({
    agents: createAllMockEvaluationAgents(),
    idFactory,
    now: () => new Date().toISOString(),
  });

  // ── Step 1: Create intake ──────────────────────────────────────────────────
  let t = performance.now();
  const intake = await service.createIntake(
    {
      title: "Client Analytics Dashboard with Real-Time Metrics",
      description:
        "Our business goal is to build an internal analytics dashboard for the client success team. " +
        "Needs real-time KPIs, Salesforce integration, role-based access, PostgreSQL backend, and " +
        "React frontend. Must handle 200 concurrent users. Timeline: Q3 launch.",
      requester: "client-success@org.com",
      department: "Client Success",
      projectType: "internal_dashboard",
    },
    ACTORS.creator,
  );
  timings.push(lap("1. createIntake", t));
  if (!intake.id) issues.push("createIntake: missing id");
  if (intake.status !== "draft") issues.push(`createIntake: expected draft, got ${intake.status}`);

  // ── Step 2: Submit ─────────────────────────────────────────────────────────
  t = performance.now();
  const submitted = await service.submitIntake(intake.id, ACTORS.creator);
  timings.push(lap("2. submitIntake", t));
  if (submitted.status !== "submitted") issues.push(`submitIntake: expected submitted, got ${submitted.status}`);

  // ── Step 3: AI Evaluation (mock orchestrator — full depth) ─────────────────
  t = performance.now();
  const evalResult = await orch.orchestrate(
    { ...submitted, externalLinks: submitted.externalLinks ?? [] },
    { actor: ACTORS.owner, depth: "full", provider: "mock", model: "mock-v1" },
  );
  timings.push(lap("3. evaluation (full-depth, mock)", t));

  let sectionTimings = [];
  if (evalResult.kind !== "evaluation_ready") {
    issues.push(`evaluation: expected evaluation_ready, got ${evalResult.kind}`);
  } else {
    sectionTimings = evalResult.evaluation.sections.map((s) => ({
      section: s.kind,
      ms: s.provenance.latencyMs ?? 0,
    }));
  }

  // ── Step 4: Map evaluation → legacy draft ──────────────────────────────────
  t = performance.now();
  const draft = evalResult.kind === "evaluation_ready"
    ? evaluationToLegacyDraft(evalResult.evaluation, { idFactory, now: new Date().toISOString() })
    : null;
  timings.push(lap("4. evaluationToLegacyDraft", t));

  // ── Step 5: Generate mock analysis draft (service layer) ───────────────────
  t = performance.now();
  const withDraft = await service.generateMockAnalysisDraft(
    submitted.id,
    { reviewerContext: "Benchmark run — standard review." },
    ACTORS.owner,
  );
  timings.push(lap("5. generateMockAnalysisDraft", t));
  if (!withDraft.latestAnalysisDraft?.id) issues.push("generateMockAnalysisDraft: missing draft id");

  // ── Step 6: Accept draft (reviewed package) ────────────────────────────────
  t = performance.now();
  const draftId = withDraft.latestAnalysisDraft.id;
  const accepted = await service.acceptAnalysisDraft(
    { intakeId: withDraft.id, draftId, reviewerNotes: "Benchmark: scope confirmed, estimates reasonable." },
    ACTORS.owner,
  );
  timings.push(lap("6. acceptAnalysisDraft", t));
  if (!accepted.reviewedProjectPackage?.id) issues.push("acceptAnalysisDraft: missing reviewedProjectPackage");
  if (accepted.latestAnalysisDraft.reviewStatus !== "accepted")
    issues.push(`acceptAnalysisDraft: expected accepted, got ${accepted.latestAnalysisDraft.reviewStatus}`);

  // ── Step 7: Gate 1 approval (intake_owner → devops_review) ────────────────
  t = performance.now();
  const gate1 = await service.recordApproval(
    accepted.id,
    { comment: "Benchmark: Gate 1 approved. Requirements clear." },
    ACTORS.owner,
  );
  timings.push(lap("7. recordApproval (Gate 1)", t));
  if (gate1.status !== "devops_review") issues.push(`Gate 1: expected devops_review, got ${gate1.status}`);
  if (!gate1.approvals?.gate_1?.locked) issues.push("Gate 1: approval not locked");

  // ── Step 8: Gate 2 approval (devops_lead → approved) ──────────────────────
  t = performance.now();
  const gate2 = await service.recordApproval(
    gate1.id,
    { comment: "Benchmark: Gate 2 approved. Infra requirements feasible." },
    ACTORS.devops,
  );
  timings.push(lap("8. recordApproval (Gate 2)", t));
  if (gate2.status !== "approved") issues.push(`Gate 2: expected approved, got ${gate2.status}`);
  if (!gate2.approvals?.gate_2?.locked) issues.push("Gate 2: approval not locked");

  // ── Step 9: Generate provisioning plan (dry-run) ───────────────────────────
  t = performance.now();
  const withPlan = await service.generateProvisioningPlan(
    gate2.id,
    { teamPrefix: "ClientSuccess", existingRepositoryNames: [], intakeRecordUrl: "http://bench/intakes/1" },
    ACTORS.devops,
  );
  timings.push(lap("9. generateProvisioningPlan", t));
  if (!withPlan.provisioningPlan?.id) issues.push("generateProvisioningPlan: missing plan");
  if (!withPlan.provisioningPlan?.actions?.length) issues.push("generateProvisioningPlan: no actions");
  const liveActions = (withPlan.provisioningPlan?.actions ?? []).filter((a) => !a.dryRun);
  if (liveActions.length > 0) issues.push(`generateProvisioningPlan: ${liveActions.length} live (non-dryRun) actions — governance violation`);

  // ── Step 10: Audit trail ──────────────────────────────────────────────────
  t = performance.now();
  const audit = await service.getAuditTrail(gate2.id);
  timings.push(lap("10. getAuditTrail", t));
  if (!Array.isArray(audit) || audit.length < 5) issues.push(`getAuditTrail: expected ≥5 events, got ${audit?.length}`);

  return { timings, sectionTimings, issues, planActionCount: withPlan.provisioningPlan?.actions?.length ?? 0, auditCount: Array.isArray(audit) ? audit.length : 0, draftSP: withDraft.latestAnalysisDraft?.estimatedStoryPoints ?? "?" };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(58)}`);
console.log(`  Project Intake OS — Governance Flow Benchmark`);
console.log(`  Runs: ${RUNS}  |  Provider: mock  |  Depth: full`);
console.log(`${"═".repeat(58)}\n`);

const allRuns = [];

for (let i = 0; i < RUNS; i++) {
  const run = await runGovernanceFlow(i + 1);
  allRuns.push(run);
  if (RUNS > 1) process.stdout.write(`  run ${i + 1}/${RUNS} complete\r`);
}

if (RUNS > 1) console.log();

// ─── Report ───────────────────────────────────────────────────────────────────

const firstRun = allRuns[0];

// Average timings across runs
const avgTimings = firstRun.timings.map((_, idx) => {
  const avg = allRuns.reduce((sum, r) => sum + r.timings[idx].ms, 0) / RUNS;
  return { label: firstRun.timings[idx].label, ms: +avg.toFixed(2) };
});

const totalMs = avgTimings.reduce((sum, t) => sum + t.ms, 0);

console.log("  Step-by-step timing:");
console.log("  " + "─".repeat(54));

const MAX_MS = Math.max(...avgTimings.map((t) => t.ms));

for (const { label, ms } of avgTimings) {
  const pct = totalMs > 0 ? ((ms / totalMs) * 100).toFixed(1) : "0.0";
  const bar = "█".repeat(Math.round((ms / MAX_MS) * 20));
  const flag = ms > 10 ? " ⚠" : ms > 1 ? "" : "";
  console.log(`  ${label.padEnd(38)} ${String(ms).padStart(7)}ms  (${pct.padStart(5)}%)  ${bar}${flag}`);
}

console.log("  " + "─".repeat(54));
console.log(`  ${"Total".padEnd(38)} ${String(totalMs.toFixed(2)).padStart(7)}ms`);

// Section-level breakdown (evaluation)
if (firstRun.sectionTimings.length > 0) {
  const sectionAvgs = firstRun.sectionTimings.map((_, idx) => {
    const avg = allRuns
      .filter((r) => r.sectionTimings[idx])
      .reduce((sum, r) => sum + (r.sectionTimings[idx]?.ms ?? 0), 0) / RUNS;
    return { section: firstRun.sectionTimings[idx].section, ms: +avg.toFixed(2) };
  });

  const sectionTotal = sectionAvgs.reduce((s, x) => s + x.ms, 0);
  const sMax = Math.max(...sectionAvgs.map((s) => s.ms));

  console.log(`\n  Evaluation section breakdown (step 3, ${sectionTotal.toFixed(1)}ms total):`);
  console.log("  " + "─".repeat(54));

  for (const { section, ms } of sectionAvgs) {
    const pct = sectionTotal > 0 ? ((ms / sectionTotal) * 100).toFixed(1) : "0.0";
    const bar = "█".repeat(Math.round((ms / sMax) * 16));
    console.log(`    ${section.padEnd(34)} ${String(ms).padStart(6)}ms  (${pct.padStart(5)}%)  ${bar}`);
  }
}

// Governance metadata
console.log(`\n  Flow metadata:`);
console.log(`    Provisioning actions  : ${firstRun.planActionCount}`);
console.log(`    Audit events recorded : ${firstRun.auditCount}`);
console.log(`    Draft story points    : ${firstRun.draftSP}`);

// Issues
const allIssues = [...new Set(allRuns.flatMap((r) => r.issues))];
if (allIssues.length > 0) {
  console.log(`\n  ⚠  Issues detected:`);
  for (const issue of allIssues) console.log(`    - ${issue}`);
} else {
  console.log(`\n  ✓ All governance guards passed (no issues)`);
}

// Bottleneck analysis
console.log(`\n  Bottleneck analysis:`);
const sorted = [...avgTimings].sort((a, b) => b.ms - a.ms);
const [top1, top2, top3] = sorted;
console.log(`    #1 slowest: ${top1.label} — ${top1.ms}ms (${((top1.ms / totalMs) * 100).toFixed(1)}% of total)`);
if (top2) console.log(`    #2 slowest: ${top2.label} — ${top2.ms}ms`);
if (top3) console.log(`    #3 slowest: ${top3.label} — ${top3.ms}ms`);

// Flag anything >10ms as notable
const notable = avgTimings.filter((t) => t.ms > 10);
if (notable.length > 0) {
  console.log(`\n    Steps >10ms (candidates for optimization):`);
  for (const { label, ms } of notable) {
    console.log(`      • ${label}: ${ms}ms`);
  }
}

console.log(`\n${"═".repeat(58)}\n`);

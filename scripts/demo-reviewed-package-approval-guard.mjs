import { InMemoryProjectIntakeStore, IntakeWorkflowService } from "../dist/src/index.js";

const creator = { id: "user-creator-01", role: "request_creator", displayName: "Alice (Requester)" };
const intakeOwner = { id: "user-intake-01", role: "intake_owner", displayName: "Bob (Intake Owner)" };
const devopsLead = { id: "user-devops-01", role: "devops_lead", displayName: "Carol (DevOps Lead)" };

let idCounter = 0;
const service = new IntakeWorkflowService({
  store: new InMemoryProjectIntakeStore(),
  clock: () => new Date().toISOString(),
  idFactory: (prefix) => `${prefix}-DEMO-${++idCounter}`,
});

console.log("=== PROJECT INTAKE OS — REVIEWED PACKAGE APPROVAL GUARD DEMO ===\n");

// Step 1: Create and submit intake
const intake = await service.createIntake(
  {
    title: "Client Analytics Dashboard",
    description: "Build a dashboard for clients to track project delivery metrics and team workload.",
    requester: "Product Team",
    department: "Digital Solutions",
    projectType: "internal_dashboard",
  },
  creator,
);
const submitted = await service.submitIntake(intake.id, creator);
console.log(`[1] Intake created and submitted: ${intake.id} | status: ${submitted.status}`);

// Step 2: Generate mock AI analysis draft
const withDraft = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
const draft = withDraft.latestAnalysisDraft;
console.log(`[2] AI draft generated: ${draft.id} | reviewStatus: ${draft.reviewStatus}`);
console.log(`    analysisDrafts.length: ${withDraft.analysisDrafts.length}`);
console.log(`    reviewedProjectPackage: ${withDraft.reviewedProjectPackage ? "EXISTS" : "missing"}`);

// Step 3: Try Gate 1 approval BEFORE human review — must be blocked
console.log("\n[3] Attempting Gate 1 approval BEFORE human review...");
let blocked = false;
try {
  await service.recordApproval(withDraft.id, { comment: "Looks good" }, intakeOwner);
  console.log("    ERROR: approval should have been blocked but was not!");
} catch (err) {
  blocked = true;
  console.log(`    Gate 1 approval BLOCKED — correct.`);
  console.log(`    Reason: ${err.message}`);
}

const stillReview = await service.getIntake(withDraft.id);
console.log(`    Intake status still: ${stillReview.status} (unchanged — correct)`);
console.log(`    approvals.gate_1:    ${stillReview.approvals.gate_1 ?? "none"} (no record created — correct)`);
console.log(`    provisioningPlan:    ${stillReview.provisioningPlan ? "EXISTS (ERROR)" : "none — correct"}`);

// Step 4: Human accepts the draft
console.log("\n[4] Human reviewer accepts the AI draft...");
const accepted = await service.acceptAnalysisDraft(
  { intakeId: withDraft.id, draftId: draft.id, reviewerNotes: "Scope and estimates confirmed." },
  intakeOwner,
);
console.log(`    Draft status:             ${accepted.latestAnalysisDraft.reviewStatus}`);
console.log(`    reviewedProjectPackage:   ${accepted.reviewedProjectPackage ? "created ✓" : "missing (ERROR)"}`);
console.log(`    Package ID:               ${accepted.reviewedProjectPackage?.id}`);
console.log(`    Package review decision:  ${accepted.reviewedProjectPackage?.reviewDecision}`);

// Step 5: Try Gate 1 approval AFTER human review — must succeed
console.log("\n[5] Attempting Gate 1 approval AFTER human review...");
const gate1 = await service.recordApproval(accepted.id, { comment: "Analysis package reviewed. Proceeding." }, intakeOwner);
console.log(`    Gate 1 approval SUCCEEDED — correct.`);
console.log(`    Intake status:  ${gate1.status}`);
console.log(`    gate_1 status:  ${gate1.approvals.gate_1.status}`);

// Step 6: Gate 2 — still works unchanged
console.log("\n[6] Gate 2 approval (DevOps)...");
const gate2 = await service.recordApproval(gate1.id, { comment: "Infrastructure confirmed." }, devopsLead);
console.log(`    Gate 2 approval SUCCEEDED.`);
console.log(`    Intake status:  ${gate2.status}`);
console.log(`    gate_2 status:  ${gate2.approvals.gate_2.status}`);

// Step 7: Print full audit trail
console.log("\n── Audit trail ────────────────────────────────────────────────────────────");
const audit = await service.getAuditTrail(intake.id);
audit.forEach((e) => console.log(`  ${e.timestamp}  ${e.actorId.padEnd(20)}  ${e.action}`));

// Summary
console.log("\n=== SUMMARY ===");
console.log(`AI draft generated:                  YES`);
console.log(`Gate 1 blocked before human review:  ${blocked ? "YES — correct" : "NO — FAILED"}`);
console.log(`Draft accepted by human reviewer:    YES`);
console.log(`Gate 1 succeeded after review:       ${gate1.approvals.gate_1?.status === "approved" ? "YES — correct" : "NO — FAILED"}`);
console.log(`Gate 2 succeeded:                    ${gate2.approvals.gate_2?.status === "approved" ? "YES" : "NO — FAILED"}`);
console.log(`Final status:                        ${gate2.status}`);
console.log("\nGovernance rule confirmed: AI drafts → Human reviews → Workflow approves → System distributes");

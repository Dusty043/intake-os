import { InMemoryProjectIntakeStore, IntakeWorkflowService } from "../dist/src/index.js";

const creator = { id: "user-creator-01", role: "request_creator", displayName: "Alice (Requester)" };
const intakeOwner = { id: "user-intake-01", role: "intake_owner", displayName: "Bob (Intake Owner)" };

let idCounter = 0;
const service = new IntakeWorkflowService({
  store: new InMemoryProjectIntakeStore(),
  clock: () => new Date().toISOString(),
  idFactory: (prefix) => `${prefix}-DEMO-${++idCounter}`,
});

console.log("=== PROJECT INTAKE OS — ANALYSIS REVIEW DEMO ===\n");

// Step 1: Create and submit intake
const intake = await service.createIntake(
  {
    title: "Client Billing Portal",
    description:
      "Build a secure client-facing portal where customers can view invoices, download statements, and manage payment preferences. Requires database, GitHub repo, and Google SSO.",
    requester: "Finance Team",
    department: "Finance",
    projectType: "client_portal",
  },
  creator,
);
console.log(`[1] Intake created:  ${intake.id} | status: ${intake.status}`);

const submitted = await service.submitIntake(intake.id, creator);
console.log(`[2] Intake submitted: status: ${submitted.status}`);

// Step 2: Generate mock AI analysis draft
const withDraft = await service.generateMockAnalysisDraft(
  submitted.id,
  { reviewerContext: "Focus on compliance and data sensitivity for a client-facing portal." },
  intakeOwner,
);
const draft = withDraft.latestAnalysisDraft;
console.log(`\n[3] AI draft generated:`);
console.log(`    Draft ID:    ${draft.id}`);
console.log(`    Provider:    ${draft.provider} (${draft.model})`);
console.log(`    Status:      ${draft.reviewStatus}  <-- draft only, not approved`);
console.log(`    Complexity:  ${draft.complexity} (${draft.estimatedStoryPoints} pts)`);
console.log(`    Confidence:  ${(draft.confidence * 100).toFixed(0)}%`);
console.log(`    Missing:     ${draft.missingInformation.join(", ") || "none"}`);
console.log(`    Warnings:    ${draft.warnings.join("; ") || "none"}`);
console.log(`    Subtasks:    ${draft.subtasks.length}`);
console.log(`\n    Approval status: gate_1=${withDraft.approvals.gate_1 ?? "none"}, gate_2=${withDraft.approvals.gate_2 ?? "none"}`);
console.log(`    Provisioning plan: ${withDraft.provisioningPlan ? "EXISTS (ERROR)" : "none — correct"}`);

// Step 3a: Demonstrate ACCEPT path
console.log("\n── PATH A: Human accepts draft as-is ─────────────────────────────────────");
const accepted = await service.acceptAnalysisDraft(
  {
    intakeId: withDraft.id,
    draftId: draft.id,
    reviewerNotes: "Scope and estimates look reasonable for MVP. Proceeding to Gate 1.",
  },
  intakeOwner,
);
const pkg = accepted.reviewedProjectPackage;
console.log(`[4] Draft accepted by: ${intakeOwner.displayName}`);
console.log(`    Draft status now:  ${accepted.latestAnalysisDraft.reviewStatus}`);
console.log(`\n    Reviewed package created:`);
console.log(`    Package ID:        ${pkg.id}`);
console.log(`    Source draft:      ${pkg.sourceDraftId}`);
console.log(`    Review decision:   ${pkg.reviewDecision}`);
console.log(`    Project type:      ${pkg.projectType}`);
console.log(`    Complexity:        ${pkg.complexity} (${pkg.estimatedStoryPoints} pts)`);
console.log(`    Tech stack:        ${pkg.recommendedTechStack.join(", ")}`);
console.log(`    Brief.problem:     ${pkg.brief.problem.slice(0, 80)}...`);
console.log(`    Subtasks:          ${pkg.subtasks.length}`);
console.log(`\n    Approval status:   gate_1=${accepted.approvals.gate_1 ?? "none"} (unchanged — correct)`);
console.log(`    Provisioning plan: ${accepted.provisioningPlan ? "EXISTS (ERROR)" : "none — correct"}`);

// Step 3b: Demonstrate REVISE path with a fresh intake
console.log("\n── PATH B: Human revises draft before approval ────────────────────────────");

const intake2 = await service.createIntake(
  {
    title: "Internal Audit Dashboard",
    description: "A simple dashboard for the audit team to track open items and deadlines.",
    requester: "Audit Team",
    department: "Finance",
    projectType: "internal_dashboard",
  },
  creator,
);
const submitted2 = await service.submitIntake(intake2.id, creator);
const withDraft2 = await service.generateMockAnalysisDraft(submitted2.id, {}, intakeOwner);
const draft2 = withDraft2.latestAnalysisDraft;

console.log(`[5] Second intake & AI draft ready: ${draft2.id} | reviewStatus: ${draft2.reviewStatus}`);
console.log(`    Original AI estimate: ${draft2.estimatedStoryPoints} pts | complexity: ${draft2.complexity}`);

const revisedHumanPackage = {
  projectType: "internal_dashboard",
  complexity: "low",
  estimatedStoryPoints: 8,
  recommendedTechStack: ["Next.js", "Supabase"],
  infrastructureRequirements: ["GitHub repo", "Supabase project"],
  brief: {
    problem: "Audit team lacks a centralised view of open items and deadlines.",
    solution: "A lightweight read-only dashboard pulling from the existing audit spreadsheet export.",
    scope: ["Dashboard MVP", "CSV import"],
    outOfScope: ["Real-time sync", "Notifications"],
  },
  subtasks: [
    { title: "Data import pipeline", description: "Parse CSV exports into Supabase.", storyPoints: 3 },
    { title: "Dashboard UI", description: "Simple table and filter view.", storyPoints: 5 },
  ],
  missingInformation: ["Data export format confirmation"],
};

const revised = await service.reviseAnalysisDraft(
  {
    intakeId: withDraft2.id,
    draftId: draft2.id,
    reviewedPackage: revisedHumanPackage,
    reviewerNotes: "Reduced scope and adjusted tech stack. Original draft preserved.",
  },
  intakeOwner,
);
const rpkg = revised.reviewedProjectPackage;
console.log(`[6] Draft revised by: ${intakeOwner.displayName}`);
console.log(`    Original draft status now: ${revised.latestAnalysisDraft.reviewStatus}  <-- superseded, not mutated`);
console.log(`    Original AI estimate still: ${revised.analysisDrafts[0].estimatedStoryPoints} pts (preserved)`);
console.log(`\n    Human-reviewed package:`);
console.log(`    Package ID:        ${rpkg.id}`);
console.log(`    Review decision:   ${rpkg.reviewDecision}`);
console.log(`    Complexity:        ${rpkg.complexity} (${rpkg.estimatedStoryPoints} pts)  <-- human-edited`);
console.log(`    Tech stack:        ${rpkg.recommendedTechStack.join(", ")}`);
console.log(`    Subtasks:          ${rpkg.subtasks.length}`);
console.log(`    Reviewer notes:    ${rpkg.reviewerNotes}`);
console.log(`\n    Approval status:   gate_1=${revised.approvals.gate_1 ?? "none"} (unchanged — correct)`);
console.log(`    Provisioning plan: ${revised.provisioningPlan ? "EXISTS (ERROR)" : "none — correct"}`);

// Step 4: Print audit trails
console.log("\n── Audit trail (PATH A — accept) ──────────────────────────────────────────");
const auditA = await service.getAuditTrail(withDraft.id);
auditA.forEach((e) => console.log(`  ${e.timestamp}  ${e.actorId.padEnd(20)}  ${e.action}`));

console.log("\n── Audit trail (PATH B — revise) ──────────────────────────────────────────");
const auditB = await service.getAuditTrail(withDraft2.id);
auditB.forEach((e) => console.log(`  ${e.timestamp}  ${e.actorId.padEnd(20)}  ${e.action}`));

// Final summary
console.log("\n=== SUMMARY ===");
console.log("AI draft generated:          YES");
console.log("Human review completed:      YES (accept + revise paths demonstrated)");
console.log("Reviewed package created:    YES");
console.log("Approval status (PATH A):    gate_1=" + (accepted.approvals.gate_1 ?? "none") + " — unchanged");
console.log("Approval status (PATH B):    gate_1=" + (revised.approvals.gate_1 ?? "none") + " — unchanged");
console.log("Provisioning plan (PATH A):  " + (accepted.provisioningPlan ? "CREATED (ERROR)" : "none — correct"));
console.log("Provisioning plan (PATH B):  " + (revised.provisioningPlan ? "CREATED (ERROR)" : "none — correct"));
console.log("\nProduct boundary confirmed: AI drafts → Human reviews → Workflow approves → System distributes");

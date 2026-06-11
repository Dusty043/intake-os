/**
 * demo-guided-regeneration.mjs
 *
 * Demonstrates the guided AI draft regeneration flow end-to-end.
 *
 * Flow:
 *   1. Submit intake
 *   2. Generate initial mock draft (v1)
 *   3. intake_owner submits guidance → v2 (visibly different summary and story points)
 *   4. devops_lead submits guidance → v3
 *   5. intake_owner accepts v3
 *   6. Confirm ReviewedProjectPackage was created from v3
 *   7. Confirm Gate 1 is available
 */

import {
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
} from "../dist/src/index.js";

let counter = 0;

const service = new IntakeWorkflowService({
  store: new InMemoryProjectIntakeStore(),
  idFactory: (prefix) => `${prefix}-${++counter}`,
});

const creator = { id: "user-creator", role: "request_creator", displayName: "Alice (Creator)" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Bob (Intake Owner)" };
const devopsLead = { id: "user-devops", role: "devops_lead", displayName: "Carol (DevOps Lead)" };

function sep(label) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

function draftSummary(label, draft) {
  console.log(`${label}:`);
  console.log(`  id                  : ${draft.id}`);
  console.log(`  reviewStatus        : ${draft.reviewStatus}`);
  console.log(`  estimatedStoryPoints: ${draft.estimatedStoryPoints}`);
  console.log(`  scope[0]            : ${draft.brief.scope[0]}`);
  if (draft.brief.scope.length > 3) {
    console.log(`  scope[3] (guidance) : ${draft.brief.scope[3]}`);
  }
}

// Step 1 — Submit intake
sep("Step 1 — Submit intake");
const intake = await service.createIntake(
  {
    title: "Payment Retry System",
    description:
      "Build a backend service for retrying failed payment transactions with exponential backoff, audit logging, and stakeholder notifications.",
    requester: "Finance Team",
    department: "Engineering",
    projectType: "api_service",
  },
  creator,
);
const submitted = await service.submitIntake(intake.id, creator);
console.log(`Intake submitted: ${submitted.id} (status: ${submitted.status})`);

// Step 2 — Generate v1
sep("Step 2 — Generate initial mock draft (v1)");
const withV1 = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
const v1 = withV1.latestAnalysisDraft;
draftSummary("v1", v1);

// Step 3 — Intake owner steers → v2
sep("Step 3 — Intake owner submits guidance → v2");
const guidance1 = "Focus on the payment retry logic, not the UI layer";
console.log(`Guidance: "${guidance1}"`);
const withV2 = await service.regenerateAnalysisDraft(
  withV1.id,
  { guidance: guidance1, requestedBy: intakeOwner.displayName },
  intakeOwner,
);
const v2 = withV2.latestAnalysisDraft;
draftSummary("v2", v2);
console.log(`  regenCount: ${withV2.analysisDraftRegenerationCount}`);
console.log(`  v1 status: ${withV2.analysisDrafts.find((d) => d.id === v1.id)?.reviewStatus}`);

// Step 4 — DevOps lead steers → v3
sep("Step 4 — DevOps lead submits guidance → v3");
const guidance2 = "Reduce scope to backend only, two sprints max, no Monday board needed";
console.log(`Guidance: "${guidance2}"`);
const withV3 = await service.regenerateAnalysisDraft(
  withV2.id,
  { guidance: guidance2, requestedBy: devopsLead.displayName },
  devopsLead,
);
const v3 = withV3.latestAnalysisDraft;
draftSummary("v3", v3);
console.log(`  regenCount: ${withV3.analysisDraftRegenerationCount}`);

// Step 5 — Accept v3
sep("Step 5 — Intake owner accepts v3");
const accepted = await service.acceptAnalysisDraft(
  { intakeId: withV3.id, draftId: v3.id, reviewerNotes: "v3 looks good — scope is correct." },
  intakeOwner,
);
console.log(`v3 reviewStatus: ${accepted.latestAnalysisDraft.reviewStatus}`);

// Step 6 — Confirm ReviewedProjectPackage
sep("Step 6 — Confirm ReviewedProjectPackage from v3");
const pkg = accepted.reviewedProjectPackage;
if (!pkg) throw new Error("ReviewedProjectPackage missing");
console.log(`  packageId     : ${pkg.id}`);
console.log(`  sourceDraftId : ${pkg.sourceDraftId}`);
console.log(`  reviewDecision: ${pkg.reviewDecision}`);
console.log(`  reviewerNotes : ${pkg.reviewerNotes}`);
if (pkg.sourceDraftId !== v3.id) throw new Error("Package not built from v3!");
console.log("  ✓ Package was built from v3");

// Step 7 — Gate 1 available
sep("Step 7 — Gate 1 available");
const approved = await service.recordApproval(accepted.id, {}, intakeOwner);
console.log(`  status after Gate 1: ${approved.status}`);
if (approved.status !== "devops_review") throw new Error("Expected devops_review after Gate 1");
console.log("  ✓ Gate 1 approved, intake moved to devops_review");

// Audit trail summary
sep("Audit trail");
const audit = await service.getAuditTrail(accepted.id);
for (const event of audit) {
  const meta = event.action === "ANALYSIS_DRAFT_REGENERATED"
    ? ` [count=${event.metadata.regenerationCount}]`
    : "";
  console.log(`  ${event.action}${meta}`);
}

console.log("\n✓ Demo complete — guided regeneration flow passed.\n");

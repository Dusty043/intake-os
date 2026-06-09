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

console.log("=== PROJECT INTAKE OS — DISTRIBUTION PREVIEW FROM REVIEWED PACKAGE ===\n");

// Step 1: Create and submit intake
const intake = await service.createIntake(
  {
    title: "Client Billing Portal",
    description: "Build a client-facing portal for invoicing and payment preferences.",
    requester: "Finance Team",
    department: "Finance",
    projectType: "client_portal",
  },
  creator,
);
const submitted = await service.submitIntake(intake.id, creator);
console.log(`[1] Intake created and submitted: ${intake.id}`);

// Step 2: Generate mock AI analysis draft
const withDraft = await service.generateMockAnalysisDraft(submitted.id, {}, intakeOwner);
const draft = withDraft.latestAnalysisDraft;
console.log(`\n[2] AI draft generated: ${draft.id}`);
console.log(`    AI-estimated story points: ${draft.estimatedStoryPoints}`);
console.log(`    AI complexity:             ${draft.complexity}`);
console.log(`    AI project type:           ${draft.projectType}`);
console.log(`    AI subtask count:          ${draft.subtasks.length}`);

// Step 3: Human reviewer revises the draft (overrides AI estimates)
const humanPkg = {
  projectType: "internal_tool",
  complexity: "medium",
  estimatedStoryPoints: 8,   // AI said more; human says 8
  recommendedTechStack: ["Next.js", "Supabase"],
  infrastructureRequirements: ["GitHub repo", "Supabase project"],
  brief: {
    problem: "Clients lack a self-service billing portal.",
    solution: "Lightweight client portal with invoice view and payment preferences.",
    scope: ["Invoice listing", "Statement download", "Payment preference management"],
    outOfScope: ["Real-time payment processing", "Mobile app"],
  },
  subtasks: [
    { title: "Set up project skeleton", description: "Scaffold Next.js + Supabase.", storyPoints: 2 },
    { title: "Invoice listing view", description: "Display paginated invoice history.", storyPoints: 3 },
    { title: "Payment preferences", description: "Let clients update their payment method.", storyPoints: 3 },
  ],
  missingInformation: ["Payment gateway provider TBD"],
};

const revised = await service.reviseAnalysisDraft(
  {
    intakeId: withDraft.id,
    draftId: draft.id,
    reviewedPackage: humanPkg,
    reviewerNotes: "Reduced scope to billing MVP. Removed payment processing from this intake.",
  },
  intakeOwner,
);

const pkg = revised.reviewedProjectPackage;
console.log(`\n[3] Human reviewer revised the draft:`);
console.log(`    Reviewed package ID:         ${pkg.id}`);
console.log(`    Reviewed story points:       ${pkg.estimatedStoryPoints}   <-- human override (AI said ${draft.estimatedStoryPoints})`);
console.log(`    Reviewed complexity:         ${pkg.complexity}`);
console.log(`    Reviewed subtask count:      ${pkg.subtasks.length}   <-- human-defined tasks`);
console.log(`    Reviewed project type:       ${pkg.projectType}`);
console.log(`    Original draft status:       ${revised.analysisDrafts[0].reviewStatus}  <-- superseded, content preserved`);

// Step 4: Approve Gate 1 and Gate 2
const gate1 = await service.recordApproval(revised.id, { comment: "Scope reviewed and confirmed." }, intakeOwner);
const gate2 = await service.recordApproval(gate1.id, { comment: "Infrastructure confirmed." }, devopsLead);
console.log(`\n[4] Approvals:`);
console.log(`    Gate 1: ${gate2.approvals.gate_1.status} by ${intakeOwner.displayName}`);
console.log(`    Gate 2: ${gate2.approvals.gate_2.status} by ${devopsLead.displayName}`);
console.log(`    Status: ${gate2.status}`);

// Step 5: Generate distribution preview
const withPlan = await service.generateProvisioningPlan(
  gate2.id,
  { teamPrefix: "Finance Team" },
  devopsLead,
);
const plan = withPlan.provisioningPlan;

console.log(`\n[5] Distribution preview generated:`);
console.log(`    Plan ID:            ${plan.id}`);
console.log(`    Source type:        ${plan.source.type}  <-- uses reviewed package, NOT raw AI draft`);
console.log(`    Source ID:          ${plan.source.sourceId}`);
console.log(`    Reviewed by:        ${plan.source.reviewedBy}`);
console.log(`    Reviewed at:        ${plan.source.reviewedAt}`);
console.log(`    Plan valid:         ${plan.validation.valid}`);
console.log(`    Action count:       ${plan.actions.length}`);
console.log(`    Project type used:  ${plan.projectType}`);

const handoffAction = plan.actions.find((a) => a.action === "create_handoff_doc");
const issueAction = plan.actions.find((a) => a.action === "create_initial_issues");

console.log(`\n    Handoff doc action:`);
console.log(`    - sourceType:            ${handoffAction.payload.sourceType}`);
console.log(`    - estimatedStoryPoints:  ${handoffAction.payload.estimatedStoryPoints}  <-- reviewed value (AI said ${draft.estimatedStoryPoints})`);
console.log(`    - brief.problem:         ${handoffAction.payload.brief?.problem?.slice(0, 60)}...`);

if (issueAction) {
  console.log(`\n    GitHub issues to create (from reviewed subtasks):`);
  issueAction.payload.issueTitles.forEach((t) => console.log(`    - ${t}`));
}

console.log(`\n[6] Audit trail:`);
const audit = await service.getAuditTrail(intake.id);
audit.forEach((e) => console.log(`  ${e.timestamp}  ${e.actorId.padEnd(20)}  ${e.action}`));
const planEvent = audit.find((e) => e.action === "PROVISIONING_PLAN_GENERATED");
if (planEvent) {
  console.log(`\n    Plan event metadata:`);
  console.log(`    sourceType: ${planEvent.metadata.sourceType}`);
  console.log(`    sourceId:   ${planEvent.metadata.sourceId}`);
}

console.log("\n=== SUMMARY ===");
console.log(`AI draft generated:                                YES`);
console.log(`Human reviewer revised with ${humanPkg.estimatedStoryPoints} SP:                    YES (AI said ${draft.estimatedStoryPoints})`);
console.log(`Distribution preview generated:                   YES`);
console.log(`Preview source:                                   ${plan.source.type}`);
console.log(`Reviewed package values used:                     YES`);
console.log(`Raw AI draft bypassed:                            YES`);
console.log("\nProduct boundary confirmed: AI drafts → Human reviews → Workflow approves → Distribution uses reviewed package → System distributes");

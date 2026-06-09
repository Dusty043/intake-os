import { createApiCompositionRoot } from "../dist/src/index.js";

const { intakeController } = createApiCompositionRoot();

const creator = { id: "user-requester", role: "request_creator", displayName: "Requester" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };
const devopsLead = { id: "user-devops", role: "devops_lead", displayName: "DevOps Lead" };

const intake = await intakeController.create(
  {
    title: "Project Intake OS",
    description: "Internal workflow system for project intake, approvals, and dry-run provisioning.",
    requester: "Digital Solutions",
    department: "Internal Tools",
    projectType: "internal_tool",
  },
  creator,
);

await intakeController.submit(intake.id, creator);
await intakeController.completeDiscovery(
  intake.id,
  {
    problemStatement: "Project requests need a traceable governance flow before GitHub/Monday provisioning.",
    stakeholders: ["Management", "DevOps", "Requesters"],
    expectedUsers: ["Internal project requesters", "DevOps leads"],
    systemsTouched: ["GitHub", "Monday", "Bitrix24"],
    dataSensitivity: "medium",
    infraNeeds: ["Postgres", "container runtime"],
    estimatedComplexity: "medium",
    requiresGithub: true,
    requiresMonday: true,
    relatedToBitrix24: true,
  },
  intakeOwner,
);
await intakeController.approve(intake.id, { comment: "Management approval for POC." }, intakeOwner);
await intakeController.approve(intake.id, { comment: "DevOps approval for dry-run provisioning." }, devopsLead);
await intakeController.generateProvisioningPlan(
  intake.id,
  {
    teamPrefix: "Digital Solutions",
    existingRepositoryNames: [],
    intakeRecordUrl: "http://localhost:3000/intakes/demo",
  },
  devopsLead,
);
const ready = await intakeController.markReadyForProvisioning(intake.id, devopsLead);
const audit = await intakeController.audit(intake.id);

console.log(JSON.stringify({
  intakeId: ready.id,
  status: ready.status,
  provisioningPlanStatus: ready.provisioningPlan?.status,
  dryRunActionCount: ready.provisioningPlan?.actions.length ?? 0,
  auditEventCount: audit.length,
  plannedSystems: Array.from(new Set(ready.provisioningPlan?.actions.map((action) => action.system) ?? [])),
}, null, 2));

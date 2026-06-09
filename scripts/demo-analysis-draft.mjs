import { createApiCompositionRoot } from "../dist/src/index.js";

const { intakeController } = createApiCompositionRoot();

const creator = { id: "user-requester", role: "request_creator", displayName: "Requester" };
const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };

const intake = await intakeController.create(
  {
    title: "Client Throughput Dashboard",
    description:
      "Build an internal dashboard for stakeholders to monitor project throughput, developer workload, API data sources, and delivery timelines. Needs GitHub and database review.",
    requester: "Digital Solutions",
    department: "Internal Tools",
    projectType: "internal_dashboard",
  },
  creator,
);

await intakeController.submit(intake.id, creator);
const analyzed = await intakeController.generateMockAnalysisDraft(
  intake.id,
  {
    reviewerContext: "First build slice. Keep analysis as a reviewable draft only.",
  },
  intakeOwner,
);
const audit = await intakeController.audit(intake.id);

console.log(
  JSON.stringify(
    {
      intakeId: analyzed.id,
      status: analyzed.status,
      latestAnalysisDraftId: analyzed.latestAnalysisDraft?.id,
      analysisProvider: analyzed.latestAnalysisDraft?.provider,
      analysisReviewStatus: analyzed.latestAnalysisDraft?.reviewStatus,
      estimatedStoryPoints: analyzed.latestAnalysisDraft?.estimatedStoryPoints,
      confidence: analyzed.latestAnalysisDraft?.confidence,
      missingInformation: analyzed.latestAnalysisDraft?.missingInformation,
      subtaskCount: analyzed.latestAnalysisDraft?.subtasks.length ?? 0,
      approvalsRecorded: Object.keys(analyzed.approvals ?? {}).length,
      hasProvisioningPlan: Boolean(analyzed.provisioningPlan),
      auditActions: audit.map((event) => event.action),
    },
    null,
    2,
  ),
);

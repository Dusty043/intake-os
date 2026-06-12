import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { WorkBreakdownSectionContent } from "../../intake-evaluation.js";
import { normalizeText, containsAny } from "./mock-agent-helpers.js";

type Subtask = WorkBreakdownSectionContent["subtasks"][number];

export class MockWorkBreakdownAgent implements EvaluationAgent<WorkBreakdownSectionContent> {
  readonly role = "work_breakdown" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<WorkBreakdownSectionContent>> {
    const { intake } = ctx;
    const projectType = ctx.projectTypeClassification?.projectType ?? intake.projectType;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    const subtasks = buildSubtasks(text, projectType);
    const milestones = buildMilestones(text, projectType);
    const dependencies = buildDependencies(text);

    return {
      sectionKind: "work_breakdown",
      content: {
        subtasks,
        milestones,
        dependencies,
      },
      confidence: 0.75,
      warnings: subtasks.length > 10 ? ["Large number of subtasks detected — consider phasing."] : [],
    };
  }
}

function buildSubtasks(text: string, projectType: string): Subtask[] {
  const tasks: Subtask[] = [];

  // Always: discovery
  tasks.push({
    title: "Discovery and requirements validation",
    description: "Review the generated evaluation with the requester. Confirm goals, scope, and success criteria.",
    acceptanceCriteria: [
      "Requester confirms the problem statement is accurate",
      "Scope is agreed upon and documented",
      "Missing information is resolved or accepted as a risk",
    ],
    estimatedHours: 4,
    suggestedOwnerRole: "Product/Project Manager",
  });

  // Architecture/design when needed
  if (containsAny(text, ["design", "wireframe", "ux", "mockup", "ui", "dashboard", "portal"])) {
    tasks.push({
      title: "UI/UX design and wireframing",
      description: "Create wireframes or design mockups for key screens.",
      acceptanceCriteria: [
        "Key screens are wireframed",
        "Design is reviewed and approved by stakeholder",
      ],
      estimatedHours: 8,
      suggestedOwnerRole: "Designer or Full-stack Developer",
    });
  }

  // Backend API
  if (containsAny(text, ["api", "backend", "endpoint", "data", "service", "database"])) {
    tasks.push({
      title: "Backend API and data model implementation",
      description: "Implement the core API endpoints, database schema, and business logic.",
      acceptanceCriteria: [
        "API endpoints are documented and tested",
        "Data model is reviewed",
        "Unit tests pass",
      ],
      estimatedHours: 16,
      suggestedOwnerRole: "Backend Developer",
    });
  }

  // Auth/security
  if (containsAny(text, ["auth", "sso", "login", "permission", "oauth"])) {
    tasks.push({
      title: "Authentication and authorization",
      description: "Implement authentication (SSO or session-based) and role-based access control.",
      acceptanceCriteria: [
        "Auth flows are tested end-to-end",
        "Role permissions are enforced",
        "Security review is completed",
      ],
      estimatedHours: 12,
      suggestedOwnerRole: "Backend Developer",
    });
  }

  // Integration
  if (containsAny(text, ["integration", "webhook", "sync", "connect", "api call"])) {
    tasks.push({
      title: "External integration implementation",
      description: "Implement integration with external systems. Include error handling and retry logic.",
      acceptanceCriteria: [
        "Integration is tested in a staging environment",
        "Error handling covers API failures and rate limits",
        "Monitoring is in place",
      ],
      estimatedHours: 12,
      suggestedOwnerRole: "Backend Developer",
    });
  }

  // Frontend
  if (containsAny(text, ["frontend", "ui", "dashboard", "form", "portal", "web app"])) {
    tasks.push({
      title: "Frontend implementation",
      description: "Implement the user-facing interface based on designs.",
      acceptanceCriteria: [
        "All designed screens are implemented",
        "Responsive on desktop and mobile",
        "Accessibility baseline is met",
      ],
      estimatedHours: 16,
      suggestedOwnerRole: "Frontend Developer",
    });
  }

  // Data migration
  if (containsAny(text, ["migration", "import", "data move", "etl", "transfer"])) {
    tasks.push({
      title: "Data migration and validation",
      description: "Write and test the data migration scripts. Validate data integrity after migration.",
      acceptanceCriteria: [
        "Migration scripts are tested on sample data",
        "Data integrity checks pass",
        "Rollback procedure is documented",
      ],
      estimatedHours: 20,
      suggestedOwnerRole: "Backend Developer / Data Engineer",
    });
  }

  // Always: testing
  tasks.push({
    title: "Integration and QA testing",
    description: "Perform end-to-end testing. Resolve critical bugs before deployment.",
    acceptanceCriteria: [
      "All critical bugs are resolved",
      "Core user flows pass end-to-end tests",
      "Reviewer signs off on test coverage",
    ],
    estimatedHours: 8,
    suggestedOwnerRole: "QA or Developer",
  });

  // Always: deployment
  tasks.push({
    title: "Deployment and handoff",
    description: "Deploy to production (or staging for initial release). Document runbook and notify stakeholders.",
    acceptanceCriteria: [
      "Successfully deployed to target environment",
      "Runbook or deployment notes are recorded",
      "Stakeholders are notified",
    ],
    estimatedHours: 4,
    suggestedOwnerRole: "DevOps / Developer",
  });

  return tasks;
}

function buildMilestones(text: string, projectType: string): string[] {
  const milestones = ["Requirements confirmed", "Implementation complete", "Deployed and handed off"];
  if (containsAny(text, ["design", "ux"])) milestones.splice(1, 0, "Design approved");
  if (containsAny(text, ["migration"])) milestones.splice(-1, 0, "Data migration validated");
  return milestones;
}

function buildDependencies(text: string): string[] {
  const deps: string[] = [];
  if (containsAny(text, ["sso", "auth", "login"])) deps.push("Auth provider access/configuration");
  if (containsAny(text, ["api", "integration"])) deps.push("External API credentials and documentation");
  if (containsAny(text, ["design", "mockup"])) deps.push("Design assets and brand guidelines");
  if (containsAny(text, ["migration", "import"])) deps.push("Source data access and format documentation");
  if (containsAny(text, ["staging", "environment"])) deps.push("Staging environment provisioned");
  return deps;
}

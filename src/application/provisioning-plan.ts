import {
  getProjectTypeDefinition,
  isGithubRequirementResolved,
  resolveGithubRequirement,
} from "../domain/project-type-registry.js";
import {
  generateDefaultLabels,
  generateRepositoryName,
} from "../domain/repository-naming.js";
import type { Actor } from "../domain/types.js";
import type {
  GenerateProvisioningPlanInput,
  ProjectIntakeRecord,
  ProvisioningPlan,
  ProvisioningPlanAction,
} from "./types.js";

export interface BuildProvisioningPlanDependencies {
  idFactory: (prefix: string) => string;
  now: string;
}

export function buildDryRunProvisioningPlan(
  intake: ProjectIntakeRecord,
  input: GenerateProvisioningPlanInput,
  actor: Actor,
  dependencies: BuildProvisioningPlanDependencies,
): ProvisioningPlan {
  const definition = getProjectTypeDefinition(intake.projectType);
  const githubRequirement = resolveGithubRequirement(
    definition.githubRequirement,
    intake.discovery?.requiresGithub,
  );
  const errors: string[] = [];
  const actions: ProvisioningPlanAction[] = [];
  const includeMondayBoard = input.includeMondayBoard ?? intake.discovery?.requiresMonday ?? definition.defaultDistributionMode !== "none";

  let repository = undefined;

  if (!isGithubRequirementResolved(githubRequirement)) {
    errors.push("github_requirement_unresolved");
  }

  if (githubRequirement === "yes") {
    repository = generateRepositoryName({
      teamPrefix: input.teamPrefix,
      projectType: intake.projectType,
      projectName: intake.title,
      existingNames: input.existingRepositoryNames,
      overrideName: input.overrideRepositoryName,
      overrideReason: input.overrideReason,
    });

    if (!repository.validation.valid) {
      errors.push(...repository.validation.errors.map((error) => `repository_${error}`));
    }

    actions.push(
      createPlanAction(dependencies.idFactory, intake.id, "github", "create_repository", "Create the canonical GitHub repository.", true, {
        name: repository.finalRepoName,
        description: intake.description,
        visibility: "private",
      }),
      createPlanAction(dependencies.idFactory, intake.id, "github", "create_default_labels", "Create default repository labels for handoff and implementation tracking.", true, {
        repository: repository.finalRepoName,
        labels: generateDefaultLabels(intake.projectType),
      }),
      createPlanAction(dependencies.idFactory, intake.id, "github", "create_initial_issues", "Create initial implementation issues after human review.", true, {
        repository: repository.finalRepoName,
        issueTitles: buildInitialIssueTitles(intake),
      }),
    );
  }

  if (includeMondayBoard) {
    actions.push(
      createPlanAction(dependencies.idFactory, intake.id, "monday", "create_board", "Create a Monday board for delivery tracking.", true, {
        boardName: intake.title,
        template: definition.defaultDistributionMode === "C" ? "automation_delivery" : "internal_project_delivery",
      }),
    );
  }

  actions.push(
    createPlanAction(dependencies.idFactory, intake.id, "docs", "create_handoff_doc", "Create the implementation handoff document from the approved intake.", false, {
      projectName: intake.title,
      intakeRecordUrl: input.intakeRecordUrl ?? null,
      evaluationDepth: definition.defaultEvaluationDepth,
    }),
  );

  if (intake.source.system === "bitrix24" && intake.source.externalId) {
    actions.push(
      createPlanAction(dependencies.idFactory, intake.id, "bitrix24", "update_origin_record", "Update the originating Bitrix24 record with intake/provisioning status.", true, {
        externalId: intake.source.externalId,
        status: "approved_pending_provisioning",
      }),
    );
  }

  return {
    id: dependencies.idFactory("PLAN"),
    intakeId: intake.id,
    projectName: intake.title,
    projectType: intake.projectType,
    status: "draft",
    generatedAt: dependencies.now,
    generatedBy: actor,
    repository,
    githubRequirement,
    evaluationDepth: definition.defaultEvaluationDepth,
    distributionMode: definition.defaultDistributionMode,
    actions,
    validation: {
      valid: errors.length === 0,
      errors,
    },
  };
}

function createPlanAction(
  idFactory: (prefix: string) => string,
  intakeId: string,
  system: ProvisioningPlanAction["system"],
  action: ProvisioningPlanAction["action"],
  description: string,
  requiresCredential: boolean,
  payload: Record<string, unknown>,
): ProvisioningPlanAction {
  const actionId = idFactory("ACT");

  return {
    id: actionId,
    system,
    action,
    description,
    dryRun: true,
    requiresCredential,
    idempotencyKey: `${intakeId}:${system}:${action}:${actionId}`,
    payload,
  };
}

function buildInitialIssueTitles(intake: ProjectIntakeRecord): readonly string[] {
  const systems = intake.discovery?.systemsTouched ?? [];
  const baseTitles = [
    "Confirm approved scope and acceptance criteria",
    "Create technical implementation plan",
    "Implement core workflow",
    "Add validation and failure handling",
    "Prepare deployment and handoff checklist",
  ];

  if (systems.length === 0) {
    return baseTitles;
  }

  return [
    ...baseTitles,
    ...systems.slice(0, 4).map((system) => `Validate integration requirements for ${system}`),
  ];
}

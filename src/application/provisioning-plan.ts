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
import { ValidationError } from "./errors.js";
import type {
  DistributionSourceType,
  GenerateProvisioningPlanInput,
  ProjectIntakeRecord,
  ProvisioningPlan,
  ProvisioningPlanAction,
  ProvisioningPlanSource,
  ReviewedProjectPackage,
} from "./types.js";

export interface BuildProvisioningPlanDependencies {
  idFactory: (prefix: string) => string;
  now: string;
}

export function resolveDistributionSource(intake: ProjectIntakeRecord): ProvisioningPlanSource {
  if (intake.reviewedProjectPackage) {
    const pkg = intake.reviewedProjectPackage;
    return {
      type: "reviewed_project_package",
      sourceId: pkg.id,
      reviewedBy: pkg.reviewedBy,
      reviewedAt: pkg.reviewedAt,
    };
  }

  const hasAnalysisDrafts = (intake.analysisDrafts?.length ?? 0) > 0;
  if (hasAnalysisDrafts) {
    throw new ValidationError(
      "Cannot generate distribution preview for an AI-assisted intake until an analysis draft has been accepted or revised into a reviewed project package.",
    );
  }

  return {
    type: intake.discovery ? "manual_discovery" : "legacy_intake_record",
    sourceId: intake.id,
  };
}

export function buildDryRunProvisioningPlan(
  intake: ProjectIntakeRecord,
  input: GenerateProvisioningPlanInput,
  actor: Actor,
  dependencies: BuildProvisioningPlanDependencies,
): ProvisioningPlan {
  const source = resolveDistributionSource(intake);
  const pkg = source.type === "reviewed_project_package" ? intake.reviewedProjectPackage! : undefined;

  const effectiveProjectType = pkg?.projectType ?? intake.projectType;
  const definition = getProjectTypeDefinition(effectiveProjectType);

  const githubRequirement = resolveGithubRequirement(
    definition.githubRequirement,
    pkg
      ? pkg.infrastructureRequirements.some((r) => r.toLowerCase().includes("github"))
      : intake.discovery?.requiresGithub,
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
      projectType: effectiveProjectType,
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
        labels: generateDefaultLabels(effectiveProjectType),
      }),
      createPlanAction(dependencies.idFactory, intake.id, "github", "create_initial_issues", "Create initial implementation issues after human review.", true, {
        repository: repository.finalRepoName,
        issueTitles: pkg ? buildIssueTitlesFromPackage(pkg) : buildInitialIssueTitles(intake),
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
      sourceType: source.type,
      estimatedStoryPoints: pkg?.estimatedStoryPoints ?? null,
      brief: pkg ? { problem: pkg.brief.problem, solution: pkg.brief.solution } : null,
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
    projectType: effectiveProjectType,
    status: "draft",
    generatedAt: dependencies.now,
    generatedBy: actor,
    source,
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

function buildIssueTitlesFromPackage(pkg: ReviewedProjectPackage): readonly string[] {
  if (pkg.subtasks.length === 0) {
    return ["Confirm approved scope and acceptance criteria", "Implement core workflow", "Prepare deployment and handoff checklist"];
  }
  return pkg.subtasks.map((t) => t.title);
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

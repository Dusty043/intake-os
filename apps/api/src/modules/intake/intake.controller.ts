import { Body, Controller, Get, Param, Post, HttpCode } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { loadRateLimitConfig } from "../../config/rate-limit.config.js";
import { toEvaluationSummaryDto } from "./dto/evaluation.dto.js";
import { toProvisioningRunDto } from "./dto/provisioning-run.dto.js";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IntakeWorkflowService } from "../../../../../src/application/intake-workflow-service.js";
import type { Actor } from "../../../../../src/domain/types.js";
import { CurrentActor } from "../auth/auth.decorators.js";
import type { AuthenticatedActor } from "../auth/auth.types.js";
import { AcceptAnalysisDraftDto } from "./dto/accept-analysis-draft.dto.js";
import { ApprovalDecisionDto } from "./dto/approval-decision.dto.js";
import { CompleteDiscoveryDto } from "./dto/complete-discovery.dto.js";
import { CreateIntakeDto } from "./dto/create-intake.dto.js";
import { GenerateMockAnalysisDraftDto } from "./dto/generate-mock-analysis-draft.dto.js";
import { GenerateProvisioningPlanDto } from "./dto/generate-provisioning-plan.dto.js";
import { RejectAnalysisDraftDto } from "./dto/reject-analysis-draft.dto.js";
import { RejectApprovalDto } from "./dto/reject-approval.dto.js";
import { RegenerateAnalysisDraftDto } from "./dto/regenerate-analysis-draft.dto.js";
import { MarkResolvedDto } from "./dto/mark-resolved.dto.js";
import { RequestChangesDto } from "./dto/request-changes.dto.js";
import { ReviseAnalysisDraftDto } from "./dto/revise-analysis-draft.dto.js";
import { LifecycleTransitionDto, lifecycleActions } from "./dto/lifecycle-transition.dto.js";
import type { LifecycleAction } from "../../../../../src/domain/lifecycle-transitions.js";
import { ValidationError } from "../../../../../src/application/errors.js";

const rlConfig = loadRateLimitConfig();

function toDomainActor(actor: AuthenticatedActor): Actor {
  return { id: actor.id, role: actor.role, displayName: actor.name };
}

@ApiTags("intakes")
@Controller("intakes")
export class IntakeHttpController {
  constructor(private readonly workflowService: IntakeWorkflowService) {}

  @Get()
  @ApiOperation({ summary: "List project intakes" })
  list() {
    return this.workflowService.listIntakes();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a project intake" })
  get(@Param("id") id: string) {
    return this.workflowService.getIntake(id);
  }

  @Post()
  @Throttle({ global: { ttl: rlConfig.intakeSubmit.ttl * 1000, limit: rlConfig.intakeSubmit.limit } })
  @ApiOperation({ summary: "Create a manual project intake" })
  create(@Body() body: CreateIntakeDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.workflowService.createIntake(body, toDomainActor(actor));
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit a draft intake for discovery" })
  submit(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.workflowService.submitIntake(id, toDomainActor(actor));
  }

  @Post(":id/resubmit")
  @ApiOperation({ summary: "Resubmit an intake that is awaiting clarification, optionally with answers" })
  resubmit(
    @Param("id") id: string,
    @Body() body: { answers?: Array<{ question: string; answer: string }> },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.resubmitIntake(id, toDomainActor(actor), body.answers);
  }

  @Post(":id/discovery")
  @ApiOperation({ summary: "Complete no-AI discovery and move the intake to Gate 1 review" })
  completeDiscovery(
    @Param("id") id: string,
    @Body() body: CompleteDiscoveryDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.completeDiscovery(id, body, toDomainActor(actor));
  }

  @Post(":id/analysis-drafts/mock")
  @Throttle({ global: { ttl: rlConfig.mockDraft.ttl * 1000, limit: rlConfig.mockDraft.limit } })
  @ApiOperation({ summary: "Generate a schema-backed mock AI analysis draft for human review" })
  generateMockAnalysisDraft(
    @Param("id") id: string,
    @Body() body: GenerateMockAnalysisDraftDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.generateMockAnalysisDraft(id, body, toDomainActor(actor));
  }

  @Post(":id/analysis-drafts/regenerate")
  @Throttle({ global: { ttl: rlConfig.draftRegeneration.ttl * 1000, limit: rlConfig.draftRegeneration.limit } })
  @ApiOperation({ summary: "Regenerate the current pending AI analysis draft with steering guidance" })
  regenerateAnalysisDraft(
    @Param("id") id: string,
    @Body() body: RegenerateAnalysisDraftDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.regenerateAnalysisDraft(
      id,
      { guidance: body.guidance, requestedBy: actor.name },
      toDomainActor(actor),
    );
  }

  @Post(":id/analysis-drafts/:draftId/accept")
  @ApiOperation({ summary: "Accept an AI analysis draft as the reviewed project package" })
  acceptAnalysisDraft(
    @Param("id") id: string,
    @Param("draftId") draftId: string,
    @Body() body: AcceptAnalysisDraftDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.acceptAnalysisDraft(
      { intakeId: id, draftId, reviewerNotes: body.reviewerNotes },
      toDomainActor(actor),
    );
  }

  @Post(":id/analysis-drafts/:draftId/reject")
  @ApiOperation({ summary: "Reject an AI analysis draft" })
  rejectAnalysisDraft(
    @Param("id") id: string,
    @Param("draftId") draftId: string,
    @Body() body: RejectAnalysisDraftDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.rejectAnalysisDraft(
      { intakeId: id, draftId, reason: body.reason },
      toDomainActor(actor),
    );
  }

  @Post(":id/analysis-drafts/:draftId/revise")
  @ApiOperation({ summary: "Revise an AI analysis draft into a human-reviewed project package" })
  reviseAnalysisDraft(
    @Param("id") id: string,
    @Param("draftId") draftId: string,
    @Body() body: ReviseAnalysisDraftDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.reviseAnalysisDraft(
      { intakeId: id, draftId, reviewedPackage: body.reviewedPackage as any, reviewerNotes: body.reviewerNotes },
      toDomainActor(actor),
    );
  }

  @Post(":id/approvals")
  @ApiOperation({ summary: "Approve the currently open approval gate" })
  approve(
    @Param("id") id: string,
    @Body() body: ApprovalDecisionDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.recordApproval(id, body, toDomainActor(actor));
  }

  @Post(":id/rejections")
  @ApiOperation({ summary: "Reject the currently open approval gate" })
  reject(
    @Param("id") id: string,
    @Body() body: RejectApprovalDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.rejectApproval(id, toDomainActor(actor), body.reason);
  }

  @Post(":id/request-changes")
  @ApiOperation({ summary: "DevOps requests changes, routing the intake back to intake review" })
  requestChanges(
    @Param("id") id: string,
    @Body() body: RequestChangesDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.requestChanges(id, toDomainActor(actor), body.reason);
  }

  @Post(":id/provisioning-plan")
  @ApiOperation({ summary: "Generate a dry-run provisioning plan after both approvals" })
  generateProvisioningPlan(
    @Param("id") id: string,
    @Body() body: GenerateProvisioningPlanDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.generateProvisioningPlan(id, body, toDomainActor(actor));
  }

  @Post(":id/provisioning-ready")
  @ApiOperation({ summary: "Mark a valid dry-run plan ready for later human-approved execution" })
  markReadyForProvisioning(
    @Param("id") id: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.markReadyForProvisioning(id, toDomainActor(actor));
  }

  @Post(":id/distribution/execute")
  @ApiOperation({ summary: "Execute distribution: run all registered provisioning adapters" })
  async executeDistribution(
    @Param("id") id: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    const run = await this.workflowService.executeDistribution(id, toDomainActor(actor));
    return toProvisioningRunDto(run);
  }

  @Get(":id/distribution/runs")
  @ApiOperation({ summary: "List provisioning runs for an intake, newest first" })
  async listProvisioningRuns(@Param("id") id: string) {
    const runs = await this.workflowService.listProvisioningRuns(id);
    return { runs: runs.map(toProvisioningRunDto) };
  }

  @Post(":id/distribution/runs/:runId/retry")
  @ApiOperation({ summary: "Retry failed provisioning targets from a previous run" })
  async retryProvisioningRun(
    @Param("id") id: string,
    @Param("runId") runId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    const run = await this.workflowService.retryFailedProvisioningTargets(id, runId, toDomainActor(actor));
    return toProvisioningRunDto(run);
  }

  @Post(":id/provisioning-targets/:targetId/mark-resolved")
  @HttpCode(200)
  @ApiOperation({ summary: "Manually mark a dead-lettered provisioning target as resolved" })
  async markProvisioningTargetResolved(
    @Param("id") id: string,
    @Param("targetId") targetId: string,
    @Body() dto: MarkResolvedDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    await this.workflowService.markProvisioningTargetResolved(id, targetId, toDomainActor(actor), dto.note);
    return { ok: true };
  }

  @Get(":id/audit")
  @ApiOperation({ summary: "Read the audit trail for an intake" })
  audit(@Param("id") id: string) {
    return this.workflowService.getAuditTrail(id);
  }

  @Get(":id/evaluations")
  @ApiOperation({ summary: "List all evaluations for an intake, newest first" })
  async listEvaluations(@Param("id") id: string) {
    const evaluations = await this.workflowService.listEvaluationsForIntake(id);
    return { evaluations: evaluations.map(toEvaluationSummaryDto) };
  }

  @Get(":id/evaluations/latest")
  @ApiOperation({ summary: "Get the latest evaluation for an intake" })
  async getLatestEvaluation(@Param("id") id: string) {
    return this.workflowService.getLatestEvaluationForIntake(id);
  }

  @Get(":id/evaluations/:evaluationId")
  @ApiOperation({ summary: "Get a specific evaluation by ID" })
  async getEvaluation(
    @Param("id") id: string,
    @Param("evaluationId") evaluationId: string,
  ) {
    return this.workflowService.getEvaluationForIntake(id, evaluationId);
  }

  @Post(":id/lifecycle/:action")
  @HttpCode(200)
  @ApiOperation({ summary: "Execute a post-distribution lifecycle transition" })
  async executeLifecycleTransition(
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() body: LifecycleTransitionDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    if (!lifecycleActions.includes(action as LifecycleAction)) {
      throw new ValidationError(
        `Unknown lifecycle action "${action}". Valid actions: ${lifecycleActions.join(", ")}.`,
      );
    }
    const record = await this.workflowService.executeLifecycleTransition(
      id,
      action as LifecycleAction,
      toDomainActor(actor),
      body,
    );
    return { ok: true, status: record.status };
  }
}

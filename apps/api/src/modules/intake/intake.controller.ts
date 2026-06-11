import { Body, Controller, Get, Param, Post } from "@nestjs/common";
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
import { ReviseAnalysisDraftDto } from "./dto/revise-analysis-draft.dto.js";

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
  @ApiOperation({ summary: "Create a manual project intake" })
  create(@Body() body: CreateIntakeDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.workflowService.createIntake(body, toDomainActor(actor));
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit a draft intake for discovery" })
  submit(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.workflowService.submitIntake(id, toDomainActor(actor));
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
  @ApiOperation({ summary: "Generate a schema-backed mock AI analysis draft for human review" })
  generateMockAnalysisDraft(
    @Param("id") id: string,
    @Body() body: GenerateMockAnalysisDraftDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workflowService.generateMockAnalysisDraft(id, body, toDomainActor(actor));
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

  @Get(":id/audit")
  @ApiOperation({ summary: "Read the audit trail for an intake" })
  audit(@Param("id") id: string) {
    return this.workflowService.getAuditTrail(id);
  }
}

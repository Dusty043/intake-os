import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { DiscoveryController } from "../../../../../src/application/discovery/index.js";
import type { DiscoverySession } from "../../../../../src/domain/discovery.js";
import { auditVisibilityForRole } from "../../../../../src/domain/permissions.js";
import type { ProjectIntakeRecord } from "../../../../../src/application/types.js";
import { NotFoundError } from "../../../../../src/application/errors.js";
import { IntakeWorkflowService } from "../../../../../src/application/intake-workflow-service.js";
import { CurrentActor } from "../auth/auth.decorators.js";
import type { AuthenticatedActor } from "../auth/auth.types.js";
import { loadRateLimitConfig } from "../../config/rate-limit.config.js";
import { DiscoveryMessageDto } from "./dto/discovery-message.dto.js";
import { AnswerClarificationDto } from "./dto/answer-clarification.dto.js";
import { SelectDirectionDto } from "./dto/select-direction.dto.js";

const DISCOVERY_SYSTEM_ACTOR = { id: "discovery-engine", role: "intake_owner" as const, name: "Discovery Engine" };

const rlConfig = loadRateLimitConfig();
// Discovery routes that can invoke a real LLM call (when AI_PROVIDER≠mock) share the same
// aiEvaluation tier the intake evaluation pipeline uses — one AI-call budget, not a second
// unthrottled path into the same provider.
const AI_THROTTLE = { global: { ttl: rlConfig.aiEvaluation.ttl * 1000, limit: rlConfig.aiEvaluation.limit } };

@ApiTags("discovery")
@Controller("discovery")
export class DiscoveryHttpController {
  private readonly logger = new Logger(DiscoveryHttpController.name);

  constructor(
    @Inject("DISCOVERY_CONTROLLER")
    private readonly discovery: DiscoveryController,
    private readonly workflowService: IntakeWorkflowService,
  ) {}

  // No dedicated "view any discovery session" permission exists in
  // permissions.ts yet — reuse the "full" audit-visibility tier (admin
  // today) as the elevated-access signal, same as intake audit visibility.
  // Give a role its own permission here if it needs cross-user session
  // access without full audit visibility.
  private canAccessAnySession(actor: AuthenticatedActor): boolean {
    return auditVisibilityForRole(actor.role) === "full";
  }

  // Every :id route funnels through here so ownership is checked once.
  // Throws the same NotFoundError as a missing session (not a 403) so a
  // caller probing another user's session ID can't distinguish "not yours"
  // from "doesn't exist".
  private async requireOwnedSession(id: string, actor: AuthenticatedActor): Promise<DiscoverySession> {
    const session = await this.discovery.getSession(id);
    if (session.userId !== actor.id && !this.canAccessAnySession(actor)) {
      throw new NotFoundError("DiscoverySession", id);
    }
    return session;
  }

  // POST /discovery
  @Post()
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Start a new discovery session" })
  startDiscovery(
    @Body() body: DiscoveryMessageDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.discovery.startDiscovery({ userId: actor.id, message: body.message });
  }

  // GET /discovery?userId=…
  @Get()
  @ApiOperation({ summary: "List discovery sessions for the current user" })
  listSessions(@CurrentActor() actor: AuthenticatedActor, @Query("userId") userId?: string) {
    const targetUserId = this.canAccessAnySession(actor) ? (userId ?? actor.id) : actor.id;
    return this.discovery.listSessions(targetUserId);
  }

  // GET /discovery/:id
  @Get(":id")
  @ApiOperation({ summary: "Get a discovery session by ID" })
  getSession(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.requireOwnedSession(id, actor);
  }

  // POST /discovery/:id/message
  @Post(":id/message")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Add a follow-up message to a discovery session" })
  async addMessage(
    @Param("id") id: string,
    @Body() body: DiscoveryMessageDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    await this.requireOwnedSession(id, actor);
    return this.discovery.addMessage(id, { message: body.message });
  }

  // POST /discovery/:id/solutions
  @Post(":id/solutions")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Generate solution options for a discovery session" })
  async generateSolutions(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    return this.discovery.generateSolutions(id);
  }

  // POST /discovery/:id/clarifications/answer
  @Post(":id/clarifications/answer")
  @HttpCode(200)
  @ApiOperation({ summary: "Answer a clarification question in a discovery session" })
  async answerClarification(
    @Param("id") id: string,
    @Body() body: AnswerClarificationDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    await this.requireOwnedSession(id, actor);
    return this.discovery.answerClarification(id, {
      questionId: body.questionId,
      answer: body.answer,
    });
  }

  // POST /discovery/:id/clarifications/skip
  @Post(":id/clarifications/skip")
  @HttpCode(200)
  @ApiOperation({ summary: "Skip remaining clarification questions and proceed with current confidence" })
  async skipClarifications(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    return this.discovery.skipClarifications(id);
  }

  // POST /discovery/:id/direction
  @Post(":id/direction")
  @ApiOperation({ summary: "Select a solution direction for a discovery session" })
  async selectDirection(
    @Param("id") id: string,
    @Body() body: SelectDirectionDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    await this.requireOwnedSession(id, actor);
    return this.discovery.selectDirection(id, { solutionId: body.solutionId });
  }

  // POST /discovery/:id/proposal
  @Post(":id/proposal")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Compose a proposal for the selected direction" })
  async composeProposal(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    return this.discovery.composeProposal(id);
  }

  // POST /discovery/:id/manifest
  @Post(":id/manifest")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Generate a provisioning manifest for the session proposal" })
  async generateManifest(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    return this.discovery.generateManifest(id);
  }

  // POST /discovery/:id/send-to-evaluation
  @Post(":id/send-to-evaluation")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Send the discovery session to evaluation, returning session and intake record" })
  async sendToEvaluation(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    const result = await this.discovery.sendToEvaluation(id);
    const intake = result.intakeRecord as ProjectIntakeRecord | null;
    if (intake?.id) {
      // Fire evaluation in the background — don't block the response
      this.workflowService
        .generateMockAnalysisDraft(intake.id, {}, DISCOVERY_SYSTEM_ACTOR)
        .catch((err: unknown) => {
          this.logger.warn(`Auto-evaluation failed for intake ${intake.id}: ${String(err)}`);
        });
    }
    return result;
  }
}

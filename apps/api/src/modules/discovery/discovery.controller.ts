import {
  Body,
  Controller,
  Get,
  GoneException,
  HttpCode,
  Inject,
  Optional,
  Param,
  Post,
  Query,
  Sse,
  StreamableFile,
  type MessageEvent,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Observable } from "rxjs";
import type { DiscoveryController } from "../../../../../src/application/discovery/index.js";
import { DiscoveryStreamRegistry, PhaseZeroPacketService } from "../../../../../src/application/discovery/index.js";
import type { DiscoverySession } from "../../../../../src/domain/discovery.js";
import { auditVisibilityForRole } from "../../../../../src/domain/permissions.js";
import { NotFoundError } from "../../../../../src/application/errors.js";
import { CurrentActor } from "../auth/auth.decorators.js";
import type { AuthenticatedActor } from "../auth/auth.types.js";
import { loadRateLimitConfig } from "../../config/rate-limit.config.js";
import { DiscoveryMessageDto } from "./dto/discovery-message.dto.js";
import { AnswerClarificationDto } from "./dto/answer-clarification.dto.js";
import { SelectDirectionDto } from "./dto/select-direction.dto.js";
import { GeneratePhaseZeroDto } from "./dto/generate-phase-zero.dto.js";

const DISCOVERY_STREAM_HEARTBEAT_MS = 15_000;
// Injectable override for tests only — production never provides this token,
// so the constructor's default (DISCOVERY_STREAM_HEARTBEAT_MS) always applies.
export const DISCOVERY_STREAM_HEARTBEAT_MS_TOKEN = "DISCOVERY_STREAM_HEARTBEAT_MS";

const rlConfig = loadRateLimitConfig();
// Discovery routes that can invoke a real LLM call (when AI_PROVIDER≠mock) share the same
// aiEvaluation tier the intake evaluation pipeline uses — one AI-call budget, not a second
// unthrottled path into the same provider.
const AI_THROTTLE = { global: { ttl: rlConfig.aiEvaluation.ttl * 1000, limit: rlConfig.aiEvaluation.limit } };

@ApiTags("discovery")
@Controller("discovery")
export class DiscoveryHttpController {
  constructor(
    @Inject("DISCOVERY_CONTROLLER")
    private readonly discovery: DiscoveryController,
    private readonly streamRegistry: DiscoveryStreamRegistry,
    private readonly phaseZero: PhaseZeroPacketService,
    @Optional()
    @Inject(DISCOVERY_STREAM_HEARTBEAT_MS_TOKEN)
    private readonly heartbeatMs?: number,
  ) {}

  private publicSession(session: DiscoverySession) {
    const { linkedIntakeId: _internalIntakeId, ...publicSession } = session;
    return { ...publicSession, manifest: null };
  }

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
  async startDiscovery(
    @Body() body: DiscoveryMessageDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.publicSession(await this.discovery.startDiscovery({ userId: actor.id, message: body.message }));
  }

  // GET /discovery?userId=…
  @Get()
  @ApiOperation({ summary: "List discovery sessions for the current user" })
  async listSessions(@CurrentActor() actor: AuthenticatedActor, @Query("userId") userId?: string) {
    const targetUserId = this.canAccessAnySession(actor) ? (userId ?? actor.id) : actor.id;
    return (await this.discovery.listSessions(targetUserId)).map((session) => this.publicSession(session));
  }

  // GET /discovery/:id
  @Get(":id")
  @ApiOperation({ summary: "Get a discovery session by ID" })
  async getSession(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.publicSession(await this.requireOwnedSession(id, actor));
  }

  // GET /discovery/:id/stream — live progress events (SSE) for a discovery
  // session. Same ownership check as every other :id route, run before the
  // stream opens; a caller who doesn't own the session gets the same 404 a
  // missing session would, not a distinguishable 403.
  @Get(":id/stream")
  @Sse()
  @ApiOperation({ summary: "Live progress stream for a discovery session" })
  async streamSession(
    @Param("id") id: string,
    @CurrentActor() actor: AuthenticatedActor,
  ): Promise<Observable<MessageEvent>> {
    await this.requireOwnedSession(id, actor);
    return new Observable<MessageEvent>((subscriber) => {
      const unsubscribe = this.streamRegistry.subscribe(id, (event) => {
        subscriber.next({ type: event.type, data: event });
      });
      // Idle gaps between stages (e.g. a long framing call) risk the proxy
      // or browser treating the connection as dead with no traffic. A
      // heartbeat every 15s keeps it alive — the frontend already ignores
      // unrecognized event types, so no client-side handling is required.
      const heartbeat = setInterval(() => {
        subscriber.next({ type: "heartbeat", data: {} });
      }, this.heartbeatMs ?? DISCOVERY_STREAM_HEARTBEAT_MS);
      return () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
    });
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
    const session = await this.discovery.addMessage(id, { message: body.message });
    return this.publicSession(session.selectedSolutionId ? await this.phaseZero.queue(id) : session);
  }

  // POST /discovery/:id/solutions
  @Post(":id/solutions")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Generate solution options for a discovery session" })
  async generateSolutions(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    return this.publicSession(await this.discovery.generateSolutions(id));
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
    const session = await this.discovery.answerClarification(id, {
      questionId: body.questionId,
      answer: body.answer,
    });
    return this.publicSession(session.selectedSolutionId ? await this.phaseZero.queue(id) : session);
  }

  // POST /discovery/:id/clarifications/skip
  @Post(":id/clarifications/skip")
  @HttpCode(200)
  @ApiOperation({ summary: "Skip remaining clarification questions and proceed with current confidence" })
  async skipClarifications(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    const session = await this.discovery.skipClarifications(id);
    return this.publicSession(session.selectedSolutionId ? await this.phaseZero.queue(id) : session);
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
    await this.discovery.selectDirection(id, { solutionId: body.solutionId });
    return this.publicSession(await this.phaseZero.queue(id));
  }

  // POST /discovery/:id/proposal
  @Post(":id/proposal")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Compose a proposal for the selected direction" })
  async composeProposal(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    const session = await this.discovery.composeProposal(id);
    return this.publicSession(session.selectedSolutionId ? await this.phaseZero.queue(id) : session);
  }

  // POST /discovery/:id/manifest
  @Post(":id/manifest")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Generate a provisioning manifest for the session proposal" })
  async generateManifest(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    throw new GoneException("Provisioning manifests are disabled. Generate a Phase 0 packet instead.");
  }

  // POST /discovery/:id/send-to-evaluation
  @Post(":id/send-to-evaluation")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Send the discovery session to evaluation, returning session and intake record" })
  async sendToEvaluation(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    throw new GoneException("Manual Intake handoff is disabled. Phase 0 generation is automatic after Discovery.");
  }

  @Post(":id/phase-zero/generate")
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: "Generate or retry a Phase 0 packet with the current Discovery evidence" })
  async generatePhaseZero(
    @Param("id") id: string,
    @Body() body: GeneratePhaseZeroDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    await this.requireOwnedSession(id, actor);
    return this.publicSession(await this.phaseZero.queue(id, body.force ?? true));
  }

  @Get(":id/phase-zero")
  @ApiOperation({ summary: "Get Phase 0 packet metadata and documents" })
  async getPhaseZero(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    return this.phaseZero.getPacket(id);
  }

  @Get(":id/phase-zero.zip")
  @ApiOperation({ summary: "Download the Phase 0 packet as a ZIP archive" })
  async downloadPhaseZero(@Param("id") id: string, @CurrentActor() actor: AuthenticatedActor) {
    await this.requireOwnedSession(id, actor);
    const archive = await this.phaseZero.download(id);
    return new StreamableFile(Buffer.from(archive), {
      type: "application/zip",
      disposition: `attachment; filename="phase-zero-${id}.zip"`,
    });
  }
}

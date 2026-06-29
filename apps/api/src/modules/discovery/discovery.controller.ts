import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { DiscoveryController } from "../../../../../src/application/discovery/index.js";
import { CurrentActor } from "../auth/auth.decorators.js";
import type { AuthenticatedActor } from "../auth/auth.types.js";

@ApiTags("discovery")
@Controller("discovery")
export class DiscoveryHttpController {
  constructor(
    @Inject("DISCOVERY_CONTROLLER")
    private readonly discovery: DiscoveryController,
  ) {}

  // POST /discovery
  @Post()
  @ApiOperation({ summary: "Start a new discovery session" })
  startDiscovery(
    @Body() body: { message: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.discovery.startDiscovery({ userId: actor.id, message: body.message });
  }

  // GET /discovery?userId=…
  @Get()
  @ApiOperation({ summary: "List discovery sessions for the current user" })
  listSessions(@CurrentActor() actor: AuthenticatedActor, @Query("userId") userId?: string) {
    return this.discovery.listSessions(userId ?? actor.id);
  }

  // GET /discovery/:id
  @Get(":id")
  @ApiOperation({ summary: "Get a discovery session by ID" })
  getSession(@Param("id") id: string) {
    return this.discovery.getSession(id);
  }

  // POST /discovery/:id/message
  @Post(":id/message")
  @ApiOperation({ summary: "Add a follow-up message to a discovery session" })
  addMessage(@Param("id") id: string, @Body() body: { message: string }) {
    return this.discovery.addMessage(id, { message: body.message });
  }

  // POST /discovery/:id/solutions
  @Post(":id/solutions")
  @ApiOperation({ summary: "Generate solution options for a discovery session" })
  generateSolutions(@Param("id") id: string) {
    return this.discovery.generateSolutions(id);
  }

  // POST /discovery/:id/clarifications/answer
  @Post(":id/clarifications/answer")
  @HttpCode(200)
  @ApiOperation({ summary: "Answer a clarification question in a discovery session" })
  answerClarification(
    @Param("id") id: string,
    @Body() body: { questionId: string; answer: string },
  ) {
    return this.discovery.answerClarification(id, {
      questionId: body.questionId,
      answer: body.answer,
    });
  }

  // POST /discovery/:id/clarifications/skip
  @Post(":id/clarifications/skip")
  @HttpCode(200)
  @ApiOperation({ summary: "Skip remaining clarification questions and proceed with current confidence" })
  skipClarifications(@Param("id") id: string) {
    return this.discovery.skipClarifications(id);
  }

  // POST /discovery/:id/direction
  @Post(":id/direction")
  @ApiOperation({ summary: "Select a solution direction for a discovery session" })
  selectDirection(@Param("id") id: string, @Body() body: { solutionId: string }) {
    return this.discovery.selectDirection(id, { solutionId: body.solutionId });
  }

  // POST /discovery/:id/proposal
  @Post(":id/proposal")
  @ApiOperation({ summary: "Compose a proposal for the selected direction" })
  composeProposal(@Param("id") id: string) {
    return this.discovery.composeProposal(id);
  }

  // POST /discovery/:id/manifest
  @Post(":id/manifest")
  @ApiOperation({ summary: "Generate a provisioning manifest for the session proposal" })
  generateManifest(@Param("id") id: string) {
    return this.discovery.generateManifest(id);
  }

  // POST /discovery/:id/send-to-evaluation
  @Post(":id/send-to-evaluation")
  @ApiOperation({ summary: "Send the discovery session to evaluation, returning session and intake record" })
  sendToEvaluation(@Param("id") id: string) {
    return this.discovery.sendToEvaluation(id);
  }
}

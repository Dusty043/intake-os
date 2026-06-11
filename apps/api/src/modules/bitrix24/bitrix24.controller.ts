import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { normalizeBitrix24IntakePayload } from "../../../../../src/application/bitrix24-adapter.js";
import { IntakeWorkflowService } from "../../../../../src/application/intake-workflow-service.js";
import { ApiActorHeaders, actorFromHeaders } from "../../common/actor.js";
import { Public } from "../auth/auth.decorators.js";

@Public()
@ApiTags("bitrix24")
@ApiActorHeaders()
@Controller("integrations/bitrix24")
export class Bitrix24Controller {
  constructor(private readonly workflowService: IntakeWorkflowService) {}

  @Post("intake-preview")
  @ApiOperation({ summary: "Preview a Bitrix24 payload as a canonical intake input" })
  preview(@Body() payload: Record<string, unknown>) {
    return normalizeBitrix24IntakePayload(payload);
  }

  @Post("intakes")
  @ApiOperation({ summary: "Create a canonical intake from a Bitrix24-shaped payload" })
  create(@Body() payload: Record<string, unknown>, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.workflowService.createIntake(normalizeBitrix24IntakePayload(payload), actorFromHeaders(headers));
  }
}

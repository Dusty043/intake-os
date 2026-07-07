import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { normalizeBitrix24IntakePayload } from "../../../../../src/application/bitrix24-adapter.js";
import { IntakeWorkflowService } from "../../../../../src/application/intake-workflow-service.js";
import type { Actor } from "../../../../../src/domain/types.js";
import { CurrentActor, Public } from "../auth/auth.decorators.js";
import type { AuthenticatedActor } from "../auth/auth.types.js";
import { assertValidBitrix24Payload } from "./dto/bitrix24-intake-payload.dto.js";

@ApiTags("bitrix24")
@Controller("integrations/bitrix24")
export class Bitrix24Controller {
  constructor(private readonly workflowService: IntakeWorkflowService) {}

  @Public()
  @Post("intake-preview")
  @ApiOperation({ summary: "Preview a Bitrix24 payload as a canonical intake input" })
  preview(@Body() payload: Record<string, unknown>) {
    return normalizeBitrix24IntakePayload(payload);
  }

  // Not @Public() — this is a machine-to-machine webhook endpoint that writes an intake, so it
  // goes through the normal AuthGuard like every other write route. Bitrix24 can't do the
  // google-session login flow, so it authenticates with a bearer service token instead (see
  // AUTH_SERVICE_TOKENS in .env.example / apps/api/src/modules/auth/service-token-resolver.ts) —
  // the same mechanism already used for other non-human callers.
  @ApiBearerAuth("service-token")
  @Post("intakes")
  @ApiOperation({ summary: "Create a canonical intake from a Bitrix24-shaped payload (requires a bearer service token)" })
  async create(@Body() payload: Record<string, unknown>, @CurrentActor() actor: AuthenticatedActor) {
    await assertValidBitrix24Payload(payload);
    return this.workflowService.createIntake(normalizeBitrix24IntakePayload(payload), toBitrix24ServiceActor(actor));
  }
}

// Once the request is authenticated, the acting identity is still derived server-side, not from
// client-suppliable x-actor-* headers — those remain a cosmetic override even under service-token
// auth (see AuthGuard), so a caller holding a valid token could otherwise still forge a display
// name/id in the audit trail. `role` and `authSubject` are the guard-verified, non-spoofable parts
// of `actor` (role comes only from the matched AUTH_SERVICE_TOKENS entry, never a header).
function toBitrix24ServiceActor(actor: AuthenticatedActor): Actor {
  return {
    id: actor.authSubject ? `bitrix24:${actor.authSubject}` : "bitrix24-integration",
    role: actor.role,
    displayName: "Bitrix24 Integration",
  };
}

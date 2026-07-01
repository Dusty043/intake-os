import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { CurrentActor } from "../auth/auth.decorators.js";
import type { AuthenticatedActor } from "../auth/auth.types.js";
import { GlobalSettingsService } from "./global-settings.service.js";
import { UpdateDiscoverySettingsDto } from "./dto/update-discovery-settings.dto.js";

const ADMIN_ROLES = new Set(["admin", "devops_lead"]);

@SkipThrottle()
@ApiTags("admin")
@Controller("admin/settings")
export class SettingsController {
  constructor(private readonly settings: GlobalSettingsService) {}

  @Get("discovery")
  @ApiOperation({ summary: "Get discovery engine settings — admin/devops_lead only" })
  async getDiscoverySettings(@CurrentActor() actor: AuthenticatedActor) {
    if (!ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException("admin or devops_lead role required.");
    }
    return this.settings.getDiscoverySettings();
  }

  @Patch("discovery")
  @ApiOperation({ summary: "Update discovery engine settings — admin/devops_lead only" })
  async updateDiscoverySettings(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: UpdateDiscoverySettingsDto,
  ) {
    if (!ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException("admin or devops_lead role required.");
    }

    if (body.confidenceThreshold !== undefined) {
      // Range is enforced by UpdateDiscoverySettingsDto's @Min/@Max — no need to re-clamp here.
      await this.settings.set("discovery.confidence_threshold", String(body.confidenceThreshold));
    }

    if (body.orgContext !== undefined) {
      await this.settings.set("discovery.org_context", body.orgContext);
    }

    return this.settings.getDiscoverySettings();
  }
}

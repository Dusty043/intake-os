import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Health check" })
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "reachable",
      aiLayer: "disabled",
      liveProvisioning: "disabled",
    };
  }
}

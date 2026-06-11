import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/auth.decorators.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@Public()
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Liveness check — API is running" })
  health() {
    return {
      status: "ok",
      aiLayer: "disabled",
      liveProvisioning: "disabled",
    };
  }

  @Get("db")
  @ApiOperation({ summary: "Readiness check — Postgres is reachable" })
  async healthDb() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "reachable",
    };
  }
}

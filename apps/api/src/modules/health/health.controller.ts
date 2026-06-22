import { Controller, Get, Inject } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IntakeAnalysisProvider } from "../../../../../src/application/intake-analysis-provider.js";
import { ANALYSIS_PROVIDER } from "../../ai/provider.token.js";
import { Public } from "../auth/auth.decorators.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@SkipThrottle()
@Public()
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ANALYSIS_PROVIDER) private readonly analysisProvider: IntakeAnalysisProvider,
  ) {}

  @Get()
  @ApiOperation({ summary: "Liveness check — API is running" })
  health() {
    const providerName = this.analysisProvider.name;
    return {
      status: "ok",
      ai: {
        provider: providerName,
        enabled: providerName !== "mock",
      },
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

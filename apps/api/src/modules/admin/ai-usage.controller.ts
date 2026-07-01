import { Controller, ForbiddenException, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { ProjectIntakeStore } from "../../../../../src/application/types.js";
import type { IDiscoverySessionStore } from "../../../../../src/application/discovery/discovery-session-store.js";
import { DISCOVERY_SESSION_STORE, PROJECT_INTAKE_STORE } from "../../persistence/store.token.js";
import { Inject } from "@nestjs/common";
import { CurrentActor } from "../auth/auth.decorators.js";
import type { AuthenticatedActor } from "../auth/auth.types.js";

const ADMIN_ROLES = new Set(["admin", "devops_lead"]);

interface NormalizedUsageRun {
  source: "evaluation" | "discovery";
  /** Only present for evaluation runs — discovery sessions precede intake creation. */
  intakeId?: string;
  model?: string;
  agentRole: string;
  totalTokens?: number;
  estimatedCostUsd?: number | null;
}

@SkipThrottle()
@ApiTags("admin")
@Controller("admin/ai-usage")
export class AiUsageController {
  constructor(
    @Inject(PROJECT_INTAKE_STORE) private readonly store: ProjectIntakeStore,
    @Inject(DISCOVERY_SESSION_STORE) private readonly discoveryStore: IDiscoverySessionStore,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all AI agent runs (intake evaluation + discovery) with optional filters — admin/devops_lead only" })
  @ApiQuery({ name: "intakeId", required: false })
  @ApiQuery({ name: "startDate", required: false, description: "ISO date string, inclusive" })
  @ApiQuery({ name: "endDate", required: false, description: "ISO date string, inclusive" })
  async listUsage(
    @CurrentActor() actor: AuthenticatedActor,
    @Query("intakeId") intakeId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    if (!ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException("admin or devops_lead role required.");
    }

    const filters = { startDate: startDate || undefined, endDate: endDate || undefined };
    const evaluationRuns = await this.store.listAllAgentRuns({ intakeId: intakeId || undefined, ...filters });
    // Discovery sessions precede intake creation, so they have no intakeId to filter by —
    // intakeId filtering only narrows evaluation runs.
    const discoveryRuns = intakeId ? [] : await this.discoveryStore.listAllUsageRecords(filters);

    const normalized = mergeUsageRuns(evaluationRuns, discoveryRuns);
    const aggregates = aggregateUsage(normalized);

    return {
      runs: evaluationRuns,
      discoveryRuns,
      ...aggregates,
    };
  }

  @Get("summary")
  @ApiOperation({ summary: "Monthly AI cost summary — admin/devops_lead only" })
  @ApiQuery({ name: "month", required: false, description: "Format: YYYY-MM (defaults to current month)" })
  async monthlySummary(
    @CurrentActor() actor: AuthenticatedActor,
    @Query("month") month?: string,
  ) {
    if (!ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException("admin or devops_lead role required.");
    }

    const target = month ?? new Date().toISOString().slice(0, 7);
    const [year, mon] = target.split("-").map(Number);
    const startDate = `${target}-01T00:00:00.000Z`;
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${target}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;

    const [evaluationRuns, discoveryRuns] = await Promise.all([
      this.store.listAllAgentRuns({ startDate, endDate }),
      this.discoveryStore.listAllUsageRecords({ startDate, endDate }),
    ]);

    const normalized = mergeUsageRuns(evaluationRuns, discoveryRuns);
    const aggregates = aggregateUsage(normalized);

    return {
      month: target,
      ...aggregates,
    };
  }
}

// ─── Shared aggregation helpers ────────────────────────────────────────────────

function mergeUsageRuns(
  evaluationRuns: Array<{ intakeId: string; model?: string; agentRole: string; totalTokens?: number; estimatedCostUsd?: number | null }>,
  discoveryRuns: Array<{ model?: string; agentRole: string; totalTokens?: number; estimatedCostUsd?: number | null }>,
): NormalizedUsageRun[] {
  return [
    ...evaluationRuns.map((r) => ({ source: "evaluation" as const, intakeId: r.intakeId, model: r.model, agentRole: r.agentRole, totalTokens: r.totalTokens, estimatedCostUsd: r.estimatedCostUsd })),
    ...discoveryRuns.map((r) => ({ source: "discovery" as const, model: r.model, agentRole: r.agentRole, totalTokens: r.totalTokens, estimatedCostUsd: r.estimatedCostUsd })),
  ];
}

function aggregateUsage(runs: NormalizedUsageRun[]) {
  const totalCostUsd = runs.reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0);
  const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0);

  const byModel: Record<string, { count: number; costUsd: number; tokens: number }> = {};
  const byAgentRole: Record<string, { count: number; costUsd: number; tokens: number }> = {};
  const bySource: Record<string, { count: number; costUsd: number; tokens: number }> = {};
  const byIntake: Record<string, { count: number; costUsd: number; tokens: number }> = {};

  for (const run of runs) {
    const model = run.model ?? "unknown";
    byModel[model] ??= { count: 0, costUsd: 0, tokens: 0 };
    byModel[model].count++;
    byModel[model].costUsd += run.estimatedCostUsd ?? 0;
    byModel[model].tokens += run.totalTokens ?? 0;

    byAgentRole[run.agentRole] ??= { count: 0, costUsd: 0, tokens: 0 };
    byAgentRole[run.agentRole].count++;
    byAgentRole[run.agentRole].costUsd += run.estimatedCostUsd ?? 0;
    byAgentRole[run.agentRole].tokens += run.totalTokens ?? 0;

    bySource[run.source] ??= { count: 0, costUsd: 0, tokens: 0 };
    bySource[run.source].count++;
    bySource[run.source].costUsd += run.estimatedCostUsd ?? 0;
    bySource[run.source].tokens += run.totalTokens ?? 0;

    if (run.intakeId) {
      byIntake[run.intakeId] ??= { count: 0, costUsd: 0, tokens: 0 };
      byIntake[run.intakeId].count++;
      byIntake[run.intakeId].costUsd += run.estimatedCostUsd ?? 0;
      byIntake[run.intakeId].tokens += run.totalTokens ?? 0;
    }
  }

  return {
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    totalTokens,
    runCount: runs.length,
    byModel,
    byAgentRole,
    bySource,
    byIntake,
  };
}

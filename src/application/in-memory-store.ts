import type { AuditEvent } from "../domain/types.js";
import type { ProjectIntakeRecord, ProjectIntakeStore, ProvisioningRun } from "./types.js";
import type { ProvisioningTargetResult } from "../domain/provisioning.js";
import type { AgentRunRecord, EvaluationPersistenceBundle } from "./evaluation-persistence.js";
import type { IntakeEvaluation } from "./intake-evaluation.js";
import { agentRunsFromEvaluation } from "./evaluation-persistence.js";
import { validateIntakeEvaluation } from "./intake-evaluation.js";
import { NotFoundError } from "./errors.js";

export class InMemoryProjectIntakeStore implements ProjectIntakeStore {
  private readonly intakes = new Map<string, ProjectIntakeRecord>();
  private readonly auditEvents = new Map<string, AuditEvent[]>();
  private readonly evaluations = new Map<string, IntakeEvaluation>();
  private readonly agentRunsByEvaluationId = new Map<string, AgentRunRecord[]>();
  private readonly provisioningRuns = new Map<string, ProvisioningRun>();

  async listIntakes(pagination?: { take?: number; skip?: number }): Promise<readonly ProjectIntakeRecord[]> {
    const sorted = Array.from(this.intakes.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const skip = pagination?.skip ?? 0;
    const take = pagination?.take;
    const page = take === undefined ? sorted.slice(skip) : sorted.slice(skip, skip + take);
    return page.map((r) => structuredClone(r));
  }

  async getIntake(id: string): Promise<ProjectIntakeRecord | null> {
    const record = this.intakes.get(id);
    return record ? structuredClone(record) : null;
  }

  async saveIntake(record: ProjectIntakeRecord): Promise<ProjectIntakeRecord> {
    const copy = structuredClone(record);
    this.intakes.set(record.id, copy);
    return structuredClone(copy);
  }

  async listAuditEvents(intakeId: string): Promise<readonly AuditEvent[]> {
    return (this.auditEvents.get(intakeId) ?? []).map((e) => structuredClone(e));
  }

  async appendAuditEvent(event: AuditEvent): Promise<AuditEvent> {
    const copy = structuredClone(event);
    const existing = this.auditEvents.get(event.requestId) ?? [];
    this.auditEvents.set(event.requestId, [...existing, copy]);
    return structuredClone(copy);
  }

  async saveEvaluation(bundle: EvaluationPersistenceBundle): Promise<void> {
    validateIntakeEvaluation(bundle.evaluation);
    this.evaluations.set(bundle.evaluation.id, structuredClone(bundle.evaluation));
    const runs = bundle.agentRuns ?? agentRunsFromEvaluation(bundle.evaluation);
    this.agentRunsByEvaluationId.set(bundle.evaluation.id, runs.map((r) => structuredClone(r)));
  }

  async getEvaluation(intakeId: string, evaluationId: string): Promise<IntakeEvaluation | undefined> {
    const ev = this.evaluations.get(evaluationId);
    if (!ev || ev.intakeId !== intakeId) return undefined;
    const result = structuredClone(ev);
    validateIntakeEvaluation(result);
    return result;
  }

  async listEvaluationsForIntake(intakeId: string): Promise<IntakeEvaluation[]> {
    return Array.from(this.evaluations.values())
      .filter((ev) => ev.intakeId === intakeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((ev) => structuredClone(ev));
  }

  async getLatestEvaluationForIntake(intakeId: string): Promise<IntakeEvaluation | undefined> {
    const all = await this.listEvaluationsForIntake(intakeId);
    return all[0];
  }

  async listAgentRuns(evaluationId: string): Promise<AgentRunRecord[]> {
    return (this.agentRunsByEvaluationId.get(evaluationId) ?? []).map((r) => structuredClone(r));
  }

  async listAllAgentRuns(
    filters?: { intakeId?: string; startDate?: string; endDate?: string },
  ): Promise<Array<AgentRunRecord & { intakeId: string }>> {
    const results: Array<AgentRunRecord & { intakeId: string }> = [];
    for (const [evalId, runs] of this.agentRunsByEvaluationId) {
      const ev = this.evaluations.get(evalId);
      if (!ev) continue;
      if (filters?.intakeId && ev.intakeId !== filters.intakeId) continue;
      for (const run of runs) {
        if (filters?.startDate && run.createdAt < filters.startDate) continue;
        if (filters?.endDate && run.createdAt > filters.endDate) continue;
        results.push({ ...structuredClone(run), intakeId: ev.intakeId });
      }
    }
    return results;
  }

  async getEvaluationById(evaluationId: string): Promise<IntakeEvaluation | undefined> {
    const ev = this.evaluations.get(evaluationId);
    if (!ev) return undefined;
    const result = structuredClone(ev);
    validateIntakeEvaluation(result);
    return result;
  }

  async saveProvisioningRun(run: ProvisioningRun): Promise<ProvisioningRun> {
    const copy = structuredClone(run);
    this.provisioningRuns.set(run.id, copy);
    return structuredClone(copy);
  }

  async createProvisioningRunIfNoneExecuting(run: ProvisioningRun): Promise<ProvisioningRun | null> {
    // No `await` between the check and the `set` below — this method runs to completion in
    // one synchronous tick, so a concurrent caller can never observe the "no executing run"
    // state in between. That's what makes this atomic where the old
    // listProvisioningRuns() + saveProvisioningRun() pair (two separately awaited calls) was
    // not: each `await` is a point where another queued call could interleave.
    const hasExecuting = Array.from(this.provisioningRuns.values()).some(
      (r) => r.intakeId === run.intakeId && r.status === "executing",
    );
    if (hasExecuting) return null;

    const copy = structuredClone(run);
    this.provisioningRuns.set(run.id, copy);
    return structuredClone(copy);
  }

  async listProvisioningRuns(intakeId: string): Promise<ProvisioningRun[]> {
    return Array.from(this.provisioningRuns.values())
      .filter((r) => r.intakeId === intakeId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getProvisioningRun(intakeId: string, runId: string): Promise<ProvisioningRun | undefined> {
    const run = this.provisioningRuns.get(runId);
    if (!run || run.intakeId !== intakeId) return undefined;
    return structuredClone(run);
  }

  async updateProvisioningTargetResult(
    targetId: string,
    updates: Partial<ProvisioningTargetResult>,
  ): Promise<void> {
    for (const run of this.provisioningRuns.values()) {
      const idx = run.targets.findIndex((t) => t.id === targetId);
      if (idx !== -1) {
        run.targets[idx] = { ...run.targets[idx], ...updates };
        return;
      }
    }
    throw new NotFoundError("Provisioning target", targetId);
  }
}

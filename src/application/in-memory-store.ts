import type { AuditEvent } from "../domain/types.js";
import type { ProjectIntakeRecord, ProjectIntakeStore, ProvisioningRun } from "./types.js";
import type { ProvisioningTargetResult } from "../domain/provisioning.js";
import type { AgentRunRecord, EvaluationPersistenceBundle } from "./evaluation-persistence.js";
import type { IntakeEvaluation } from "./intake-evaluation.js";
import { agentRunsFromEvaluation } from "./evaluation-persistence.js";
import { validateIntakeEvaluation } from "./intake-evaluation.js";

export class InMemoryProjectIntakeStore implements ProjectIntakeStore {
  private readonly intakes = new Map<string, ProjectIntakeRecord>();
  private readonly auditEvents = new Map<string, AuditEvent[]>();
  private readonly evaluations = new Map<string, IntakeEvaluation>();
  private readonly agentRunsByEvaluationId = new Map<string, AgentRunRecord[]>();
  private readonly provisioningRuns = new Map<string, ProvisioningRun>();

  async listIntakes(): Promise<readonly ProjectIntakeRecord[]> {
    return Array.from(this.intakes.values()).map(cloneRecord);
  }

  async getIntake(id: string): Promise<ProjectIntakeRecord | null> {
    const record = this.intakes.get(id);
    return record ? cloneRecord(record) : null;
  }

  async saveIntake(record: ProjectIntakeRecord): Promise<ProjectIntakeRecord> {
    const copy = cloneRecord(record);
    this.intakes.set(record.id, copy);
    return cloneRecord(copy);
  }

  async listAuditEvents(intakeId: string): Promise<readonly AuditEvent[]> {
    return (this.auditEvents.get(intakeId) ?? []).map(cloneAuditEvent);
  }

  async appendAuditEvent(event: AuditEvent): Promise<AuditEvent> {
    const copy = cloneAuditEvent(event);
    const existing = this.auditEvents.get(event.requestId) ?? [];
    this.auditEvents.set(event.requestId, [...existing, copy]);
    return cloneAuditEvent(copy);
  }

  async saveEvaluation(bundle: EvaluationPersistenceBundle): Promise<void> {
    validateIntakeEvaluation(bundle.evaluation);
    this.evaluations.set(bundle.evaluation.id, clone<IntakeEvaluation>(bundle.evaluation));
    const runs = bundle.agentRuns ?? agentRunsFromEvaluation(bundle.evaluation);
    this.agentRunsByEvaluationId.set(bundle.evaluation.id, runs.map((r) => clone<AgentRunRecord>(r)));
  }

  async getEvaluation(intakeId: string, evaluationId: string): Promise<IntakeEvaluation | undefined> {
    const ev = this.evaluations.get(evaluationId);
    if (!ev || ev.intakeId !== intakeId) return undefined;
    const result = clone<IntakeEvaluation>(ev);
    validateIntakeEvaluation(result);
    return result;
  }

  async listEvaluationsForIntake(intakeId: string): Promise<IntakeEvaluation[]> {
    return Array.from(this.evaluations.values())
      .filter((ev) => ev.intakeId === intakeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((ev) => clone<IntakeEvaluation>(ev));
  }

  async getLatestEvaluationForIntake(intakeId: string): Promise<IntakeEvaluation | undefined> {
    const all = await this.listEvaluationsForIntake(intakeId);
    return all[0];
  }

  async listAgentRuns(evaluationId: string): Promise<AgentRunRecord[]> {
    return (this.agentRunsByEvaluationId.get(evaluationId) ?? []).map((r) => clone<AgentRunRecord>(r));
  }

  async getEvaluationById(evaluationId: string): Promise<IntakeEvaluation | undefined> {
    const ev = this.evaluations.get(evaluationId);
    if (!ev) return undefined;
    const result = clone<IntakeEvaluation>(ev);
    validateIntakeEvaluation(result);
    return result;
  }

  async saveProvisioningRun(run: ProvisioningRun): Promise<ProvisioningRun> {
    const copy = clone<ProvisioningRun>(run);
    this.provisioningRuns.set(run.id, copy);
    return clone<ProvisioningRun>(copy);
  }

  async listProvisioningRuns(intakeId: string): Promise<ProvisioningRun[]> {
    return Array.from(this.provisioningRuns.values())
      .filter((r) => r.intakeId === intakeId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getProvisioningRun(intakeId: string, runId: string): Promise<ProvisioningRun | undefined> {
    const run = this.provisioningRuns.get(runId);
    if (!run || run.intakeId !== intakeId) return undefined;
    return clone<ProvisioningRun>(run);
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
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneRecord(record: ProjectIntakeRecord): ProjectIntakeRecord {
  return clone<ProjectIntakeRecord>(record);
}

function cloneAuditEvent(event: AuditEvent): AuditEvent {
  return clone<AuditEvent>(event);
}

import type { AuditEvent } from "../domain/types.js";
import type { ProjectIntakeRecord, ProjectIntakeStore } from "./types.js";

export class InMemoryProjectIntakeStore implements ProjectIntakeStore {
  private readonly intakes = new Map<string, ProjectIntakeRecord>();
  private readonly auditEvents = new Map<string, AuditEvent[]>();

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
}

function cloneRecord(record: ProjectIntakeRecord): ProjectIntakeRecord {
  return JSON.parse(JSON.stringify(record)) as ProjectIntakeRecord;
}

function cloneAuditEvent(event: AuditEvent): AuditEvent {
  return JSON.parse(JSON.stringify(event)) as AuditEvent;
}

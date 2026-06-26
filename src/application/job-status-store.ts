export type JobState = "pending" | "running" | "done" | "failed";

export interface JobRecord {
  jobId: string;
  intakeId: string;
  jobType: string;
  state: JobState;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  ttl?: number;
}

export interface JobStatusStore {
  put(record: JobRecord): Promise<void>;
  get(jobId: string): Promise<JobRecord | null>;
  update(jobId: string, patch: Partial<Pick<JobRecord, "state" | "startedAt" | "finishedAt" | "error">>): Promise<void>;
  delete(jobId: string): Promise<void>;
}

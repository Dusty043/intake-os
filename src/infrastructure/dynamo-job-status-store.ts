import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { JobRecord, JobState, JobStatusStore } from "../application/job-status-store.js";

export class DynamoJobStatusStore implements JobStatusStore {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(tableName: string, client?: DynamoDBClient) {
    const base = client ?? new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = tableName;
  }

  async put(record: JobRecord): Promise<void> {
    await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item: record }),
    );
  }

  async get(jobId: string): Promise<JobRecord | null> {
    const { Item } = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { jobId } }),
    );
    return Item ? (Item as JobRecord) : null;
  }

  async update(
    jobId: string,
    patch: Partial<Pick<JobRecord, "state" | "startedAt" | "finishedAt" | "error">>,
  ): Promise<void> {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;

    const exprParts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    for (const [key, val] of entries) {
      const nameKey = `#${key}`;
      const valKey = `:${key}`;
      exprParts.push(`${nameKey} = ${valKey}`);
      names[nameKey] = key;
      values[valKey] = val;
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { jobId },
        UpdateExpression: `SET ${exprParts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  async delete(jobId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({ TableName: this.tableName, Key: { jobId } }),
    );
  }
}

export function buildJobState(
  isStarted: boolean,
  isFinished: boolean,
  hasFailed: boolean,
): JobState {
  if (hasFailed) return "failed";
  if (isFinished) return "done";
  if (isStarted) return "running";
  return "pending";
}

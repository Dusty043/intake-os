import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { JobRecord, JobState, JobStatusStore } from "../application/job-status-store.js";

export class DynamoJobStatusStore implements JobStatusStore {
  private readonly client: DynamoDBClient;
  private readonly tableName: string;

  constructor(tableName: string, client?: DynamoDBClient) {
    this.tableName = tableName;
    this.client = client ?? new DynamoDBClient({});
  }

  async put(record: JobRecord): Promise<void> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(record, { removeUndefinedValues: true }),
      }),
    );
  }

  async get(jobId: string): Promise<JobRecord | null> {
    const { Item } = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ jobId }),
      }),
    );
    return Item ? (unmarshall(Item) as JobRecord) : null;
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

    await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ jobId }),
        UpdateExpression: `SET ${exprParts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values),
      }),
    );
  }

  async delete(jobId: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ jobId }),
      }),
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

const DEFAULT_API_VERSION = "2026-04";

export interface MondayConfig {
  apiToken: string;
  boardId: string;
  groupId: string;
  columnMap: Record<string, string>;
  apiVersion: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[Monday] ${name} is not set. See HANDOFF-0023D-monday-credentials.md.`);
  }
  return value;
}

function parseColumnMap(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[Monday] MONDAY_COLUMN_MAP_JSON is not valid JSON.`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `[Monday] MONDAY_COLUMN_MAP_JSON must be a JSON object of { column_id: field_source }.`,
    );
  }
  return parsed as Record<string, string>;
}

export function validateMondayConfig(): MondayConfig {
  return {
    apiToken: requireEnv("MONDAY_API_TOKEN"),
    boardId: requireEnv("MONDAY_BOARD_ID"),
    groupId: requireEnv("MONDAY_GROUP_ID"),
    columnMap: parseColumnMap(requireEnv("MONDAY_COLUMN_MAP_JSON")),
    apiVersion: process.env.MONDAY_API_VERSION ?? DEFAULT_API_VERSION,
  };
}

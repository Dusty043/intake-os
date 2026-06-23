import type { TeamMemberRosterRecord } from "./roster-types.js";

export interface RosterApiConfig {
  baseUrl: string | undefined;
  apiKey: string | undefined;
  timeoutMs?: number;
}

export class RosterApiClient {
  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(config: RosterApiConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 4000;
  }

  get isConnected(): boolean {
    return !!this.baseUrl;
  }

  async fetchRoster(): Promise<TeamMemberRosterRecord[]> {
    if (!this.baseUrl) return [];

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.baseUrl, { headers, signal: controller.signal });
      if (!res.ok) return [];
      const raw = await res.json() as unknown;
      return normalizeRosterResponse(raw);
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeRosterResponse(raw: unknown): TeamMemberRosterRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      id: String(item["id"] ?? item["_id"] ?? item["email"] ?? Math.random()),
      name: String(item["name"] ?? item["displayName"] ?? "Unknown"),
      email: typeof item["email"] === "string" ? item["email"] : undefined,
      role: typeof item["role"] === "string" ? item["role"] : undefined,
      skills: toStringArray(item["skills"]),
      projectTypes: toStringArray(item["projectTypes"] ?? item["project_types"] ?? item["projects"]),
      seniority: toSeniority(item["seniority"]),
      availability: toAvailability(item["availability"]),
      currentLoad: toNumber(item["currentLoad"] ?? item["current_load"]),
      maxCapacity: toNumber(item["maxCapacity"] ?? item["max_capacity"]),
      activeProjectCount: toNumber(item["activeProjectCount"] ?? item["active_project_count"]),
      githubUsername: typeof item["githubUsername"] === "string" ? item["githubUsername"] : undefined,
      mondayUserId: typeof item["mondayUserId"] === "string" ? item["mondayUserId"] : undefined,
    }));
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  if (typeof val === "string" && val.length > 0) return val.split(",").map((s) => s.trim());
  return [];
}

function toNumber(val: unknown): number | undefined {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = parseFloat(val); return isNaN(n) ? undefined : n; }
  return undefined;
}

function toSeniority(val: unknown): TeamMemberRosterRecord["seniority"] {
  if (val === "junior" || val === "mid" || val === "senior" || val === "lead") return val;
  return undefined;
}

function toAvailability(val: unknown): TeamMemberRosterRecord["availability"] {
  if (val === "available" || val === "limited" || val === "unavailable" || val === "unknown") return val;
  return undefined;
}

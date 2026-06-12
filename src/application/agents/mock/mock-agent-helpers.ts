// Shared deterministic helpers for all mock evaluation agents.
// Port key heuristics from intake-analysis.ts — no duplication of large business logic.

export function normalizeText(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

export function containsAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t));
}

export function extractBulletishSignals(text: string, signals: string[]): string[] {
  return signals.filter((s) => text.includes(s));
}

export function summarize(value: string, maxLength: number): string {
  const n = normalizeText(value);
  if (n.length <= maxLength) return n;
  return `${n.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

// ─── Complexity ───────────────────────────────────────────────────────────────

const HIGH_SIGNALS = [
  "hipaa", "baa", "multi-tenant", "production", "aws", "compliance",
  "migration", "sso", "auth", "security", "infra", "infrastructure",
  "saas", "external api", "salesforce", "regulated", "payment",
];

const LOW_SIGNALS = [
  "simple", "report", "dashboard", "no-code", "tracking", "form",
  "spreadsheet", "monday", "google sheets", "airtable",
];

export function inferComplexity(text: string): "low" | "medium" | "high" {
  if (containsAny(text, HIGH_SIGNALS)) return "high";
  if (containsAny(text, LOW_SIGNALS) && text.length < 400) return "low";
  return "medium";
}

// ─── Story Points ─────────────────────────────────────────────────────────────

export function estimateStoryPoints(text: string): number {
  const complexity = inferComplexity(text);
  const base = { low: 5, medium: 13, high: 34 }[complexity];

  let pts = base;
  if (containsAny(text, ["integration", "webhook", "api"])) pts += 3;
  if (containsAny(text, ["auth", "sso", "oauth", "permission"])) pts += 5;
  if (containsAny(text, ["migration", "import", "export", "etl"])) pts += 8;
  if (containsAny(text, ["chrome", "extension"])) pts += 5;
  if (containsAny(text, ["compliance", "hipaa", "baa"])) pts += 8;

  return Math.max(3, pts);
}

// ─── Project Type ─────────────────────────────────────────────────────────────

export function inferProjectTypeFromText(text: string): string {
  if (containsAny(text, ["dashboard", "report", "analytics", "chart", "kpi"])) return "internal_dashboard";
  if (containsAny(text, ["api", "webhook", "integration", "sync", "data sync"])) return "data_sync_integration";
  if (containsAny(text, ["sso", "auth", "permission", "access", "login"])) return "internal_tool";
  if (containsAny(text, ["portal", "client", "customer", "external user"])) return "client_portal";
  if (containsAny(text, ["automation", "workflow", "monday", "n8n", "trigger"])) return "n8n_automation";
  if (containsAny(text, ["ai", "llm", "gpt", "claude", "openai", "anthropic"])) return "ai_workflow_tool";
  if (containsAny(text, ["saas", "product", "subscription", "billing"])) return "saas_platform";
  if (containsAny(text, ["schedule", "cron", "report", "notify", "email"])) return "reporting_automation";
  if (containsAny(text, ["research", "discovery", "explore", "spike", "evaluate"])) return "discovery_research";
  if (containsAny(text, ["backend", "service", "endpoint", "rest", "grpc"])) return "api_service";
  return "internal_tool";
}

// ─── Evaluation Depth ─────────────────────────────────────────────────────────

export function inferDepthFromText(text: string): "light" | "standard" | "full" {
  if (containsAny(text, [
    "migration", "infra", "infrastructure", "security", "multi-system",
    "hipaa", "compliance", "baa", "production deploy", "saas", "multi-tenant",
  ])) return "full";

  if (containsAny(text, [
    "simple", "report", "dashboard only", "no-code", "tracking", "read-only",
  ]) && text.length < 300) return "light";

  return "standard";
}

// ─── Tech Stack ───────────────────────────────────────────────────────────────

const STACK_BY_TYPE: Record<string, string[]> = {
  n8n_automation:       ["n8n", "HTTP APIs", "Google Workspace", "Monday API"],
  data_sync_integration: ["NestJS", "Postgres", "scheduled worker", "external API client"],
  internal_dashboard:   ["Next.js", "NestJS", "Postgres", "dashboard charts"],
  internal_tool:        ["Next.js", "NestJS", "Postgres", "Prisma", "Docker"],
  client_portal:        ["Next.js", "NestJS", "Postgres", "Google SSO", "Vercel"],
  saas_platform:        ["Next.js", "NestJS", "Postgres", "Prisma", "AWS", "observability"],
  api_service:          ["NestJS", "Postgres", "OpenAPI/Swagger", "Docker"],
  ai_workflow_tool:     ["NestJS", "LLM provider", "Postgres", "structured outputs"],
  discovery_research:   ["research brief", "ADR", "implementation estimate"],
  reporting_automation: ["scheduled worker", "Postgres", "report generation", "notification adapter"],
};

export function inferTechStack(projectType: string, text: string): string[] {
  const base: string[] = STACK_BY_TYPE[projectType] ? [...STACK_BY_TYPE[projectType]] : ["Next.js", "NestJS", "Postgres"];
  if (containsAny(text, ["supabase"]) && !base.includes("Supabase")) base.push("Supabase");
  if (containsAny(text, ["chrome", "extension"]) && !base.includes("Chrome extension APIs")) base.push("Chrome extension APIs");
  if (containsAny(text, ["redis", "cache"]) && !base.includes("Redis")) base.push("Redis");
  return base;
}

// ─── Integration Points ───────────────────────────────────────────────────────

const KNOWN_INTEGRATIONS: Record<string, string> = {
  slack: "Slack API",
  monday: "Monday.com API",
  github: "GitHub API",
  salesforce: "Salesforce API",
  google: "Google Workspace APIs",
  hubspot: "HubSpot CRM API",
  stripe: "Stripe Payments API",
  twilio: "Twilio SMS/Voice API",
  zapier: "Zapier webhooks",
  sendgrid: "SendGrid Email API",
};

export function detectIntegrationPoints(text: string): string[] {
  return Object.entries(KNOWN_INTEGRATIONS)
    .filter(([key]) => text.includes(key))
    .map(([, label]) => label);
}

// ─── Data Stores ──────────────────────────────────────────────────────────────

export function detectDataStores(text: string): string[] {
  const stores: string[] = [];
  if (containsAny(text, ["postgres", "postgresql", "database", "db"])) stores.push("PostgreSQL");
  if (containsAny(text, ["redis", "cache"])) stores.push("Redis");
  if (containsAny(text, ["s3", "blob", "file storage", "upload"])) stores.push("Object storage (S3/Blob)");
  if (containsAny(text, ["elasticsearch", "search index"])) stores.push("Elasticsearch");
  if (stores.length === 0 && containsAny(text, ["data", "store", "persist"])) stores.push("PostgreSQL");
  return stores;
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

export function buildDeterministicWarnings(text: string): string[] {
  const warnings: string[] = [];
  if (text.length < 60) warnings.push("Intake description is very short — estimates may be unreliable.");
  if (!containsAny(text, ["deadline", "due", "timeline", "when", "by"])) {
    warnings.push("No timeline or deadline detected. Estimates assume standard velocity.");
  }
  if (!containsAny(text, ["user", "requester", "stakeholder", "team", "customer"])) {
    warnings.push("No target users or stakeholders detected.");
  }
  if (containsAny(text, ["production", "live", "migrate"]) && !containsAny(text, ["test", "staging"])) {
    warnings.push("Production or live data mentioned — security/compliance review recommended.");
  }
  return warnings;
}

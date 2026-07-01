export interface RateLimitTier {
  ttl: number;
  limit: number;
}

export interface RateLimitConfig {
  global: RateLimitTier;
  intakeSubmit: RateLimitTier;
  aiEvaluation: RateLimitTier;
  draftRegeneration: RateLimitTier;
  mockDraft: RateLimitTier;
  inboundWebhook: RateLimitTier;
}

// A missing env var is normal (use the default silently). A *present but unusable* value
// (non-numeric, zero, or negative) is a misconfiguration — fall back to the default rather
// than let NaN/0 reach ThrottlerModule, which would silently disable or always-trip that tier.
function parsePositiveInt(envVarName: string, defaultValue: number): number {
  const raw = process.env[envVarName];
  if (raw === undefined || raw === "") return defaultValue;

  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[RateLimit] ${envVarName}="${raw}" is not a positive integer — using default ${defaultValue}.`,
    );
    return defaultValue;
  }
  return parsed;
}

export function loadRateLimitConfig(): RateLimitConfig {
  return {
    global: {
      ttl: parsePositiveInt("RATE_LIMIT_GLOBAL_TTL", 60),
      limit: parsePositiveInt("RATE_LIMIT_GLOBAL_LIMIT", 60),
    },
    intakeSubmit: {
      ttl: parsePositiveInt("RATE_LIMIT_INTAKE_TTL", 60),
      limit: parsePositiveInt("RATE_LIMIT_INTAKE_LIMIT", 10),
    },
    aiEvaluation: {
      ttl: parsePositiveInt("RATE_LIMIT_AI_TTL", 60),
      limit: parsePositiveInt("RATE_LIMIT_AI_LIMIT", 5),
    },
    draftRegeneration: {
      ttl: parsePositiveInt("RATE_LIMIT_REGEN_TTL", 60),
      limit: parsePositiveInt("RATE_LIMIT_REGEN_LIMIT", 5),
    },
    mockDraft: {
      ttl: parsePositiveInt("RATE_LIMIT_MOCK_TTL", 60),
      limit: parsePositiveInt("RATE_LIMIT_MOCK_LIMIT", 10),
    },
    inboundWebhook: {
      ttl: parsePositiveInt("RATE_LIMIT_WEBHOOK_TTL", 60),
      limit: parsePositiveInt("RATE_LIMIT_WEBHOOK_LIMIT", 100),
    },
  };
}

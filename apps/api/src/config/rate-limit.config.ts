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

export function loadRateLimitConfig(): RateLimitConfig {
  return {
    global: {
      ttl: parseInt(process.env.RATE_LIMIT_GLOBAL_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_GLOBAL_LIMIT ?? "60"),
    },
    intakeSubmit: {
      ttl: parseInt(process.env.RATE_LIMIT_INTAKE_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_INTAKE_LIMIT ?? "10"),
    },
    aiEvaluation: {
      ttl: parseInt(process.env.RATE_LIMIT_AI_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_AI_LIMIT ?? "5"),
    },
    draftRegeneration: {
      ttl: parseInt(process.env.RATE_LIMIT_REGEN_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_REGEN_LIMIT ?? "5"),
    },
    mockDraft: {
      ttl: parseInt(process.env.RATE_LIMIT_MOCK_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_MOCK_LIMIT ?? "10"),
    },
    inboundWebhook: {
      ttl: parseInt(process.env.RATE_LIMIT_WEBHOOK_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_WEBHOOK_LIMIT ?? "100"),
    },
  };
}

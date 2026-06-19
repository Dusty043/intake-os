export const provisioningErrorCategories = [
  "transient_api_error",
  "rate_limit",
  "auth_error",
  "validation_error",
  "collision",
  "config_error",
  "unknown",
] as const;

export type ProvisioningErrorCategory =
  (typeof provisioningErrorCategories)[number];

const AUTO_RETRY_CATEGORIES = new Set<ProvisioningErrorCategory>([
  "transient_api_error",
  "rate_limit",
]);

export function isAutoRetryable(category: ProvisioningErrorCategory): boolean {
  return AUTO_RETRY_CATEGORIES.has(category);
}

export function normalizeProvisioningError(
  err: unknown,
): { category: ProvisioningErrorCategory; message: string; retryable: boolean } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  let category: ProvisioningErrorCategory;

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    category = "rate_limit";
  } else if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("auth")) {
    category = "auth_error";
  } else if (lower.includes("400") || lower.includes("invalid") || lower.includes("validation")) {
    category = "validation_error";
  } else if (lower.includes("already exists") || lower.includes("conflict") || lower.includes("409")) {
    category = "collision";
  } else if (lower.includes("config") || lower.includes("missing") || lower.includes("not configured")) {
    category = "config_error";
  } else if (
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("enotfound")
  ) {
    category = "transient_api_error";
  } else {
    category = "unknown";
  }

  return {
    category,
    message: msg,
    retryable: isAutoRetryable(category),
  };
}

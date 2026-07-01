export type AuthMode = "dev_headers" | "google";

const VALID_MODES: AuthMode[] = ["dev_headers", "google"];

export interface AuthConfig {
  mode: AuthMode;
}

export function validateAuthConfig(): AuthConfig {
  const raw = process.env.AUTH_MODE;
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  if (!raw) {
    if (isProduction) {
      throw new Error(
        "[Auth] AUTH_MODE is not set. AUTH_MODE=google is required in production. " +
          "Set AUTH_MODE=dev_headers only for local development.",
      );
    }
    return { mode: "dev_headers" };
  }

  if (!VALID_MODES.includes(raw as AuthMode)) {
    throw new Error(
      `[Auth] Invalid AUTH_MODE="${raw}". Accepted values: ${VALID_MODES.join(", ")}`,
    );
  }

  if (isProduction && raw === "dev_headers") {
    throw new Error(
      "[Auth] AUTH_MODE=dev_headers is not permitted in production. " +
        "Set AUTH_MODE=google and configure Google OAuth credentials.",
    );
  }

  if (raw === "google" && !process.env.AUTH_GOOGLE_CLIENT_ID) {
    throw new Error(
      "[Auth] AUTH_MODE=google requires AUTH_GOOGLE_CLIENT_ID to be set.",
    );
  }

  if (raw === "google" && !process.env.AUTH_GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "[Auth] AUTH_MODE=google requires AUTH_GOOGLE_CLIENT_SECRET to be set.",
    );
  }

  if (raw === "google" && !process.env.AUTH_SESSION_COOKIE_NAME) {
    throw new Error(
      "[Auth] AUTH_MODE=google requires AUTH_SESSION_COOKIE_NAME to be set. " +
        'The "intake_os_session" fallback used elsewhere is a dev_headers-only default.',
    );
  }

  return { mode: raw as AuthMode };
}

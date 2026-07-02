import type { UserRole } from "../../../../../src/domain/types.js";
import { userRoles } from "../../../../../src/domain/types.js";

export interface ServiceToken {
  name: string;
  role: UserRole;
}

/**
 * Parses AUTH_SERVICE_TOKENS="name:token:role,name:token:role" into a token → identity map.
 * Role comes from this server-side config only — never from a client-supplied header —
 * so a caller can't escalate its own privileges by relabeling itself.
 */
export function parseServiceTokens(raw: string | undefined): Map<string, ServiceToken> {
  const tokens = new Map<string, ServiceToken>();
  if (!raw) return tokens;

  for (const entry of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
    const [name, token, role] = entry.split(":").map((part) => part?.trim());

    if (!name || !token || !role) {
      throw new Error(
        `[Auth] Invalid AUTH_SERVICE_TOKENS entry "${entry}". Expected format "name:token:role".`,
      );
    }

    if (!userRoles.includes(role as UserRole)) {
      throw new Error(
        `[Auth] Invalid role "${role}" for service token "${name}" in AUTH_SERVICE_TOKENS. ` +
          `Accepted roles: ${userRoles.join(", ")}`,
      );
    }

    tokens.set(token, { name, role: role as UserRole });
  }

  return tokens;
}

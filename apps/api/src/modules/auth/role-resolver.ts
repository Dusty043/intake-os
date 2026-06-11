import type { UserRole } from "../../../../../src/domain/types.js";

export interface RoleResolverConfig {
  adminEmails: string[];
  intakeOwnerEmails: string[];
  devopsLeadEmails: string[];
  developerEmails: string[];
  allowedEmails: string[];
  allowedDomains: string[];
  defaultRole: UserRole;
}

export function resolveRoleFromEmail(
  email: string,
  config: RoleResolverConfig,
): UserRole | null {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";

  if (config.adminEmails.includes(normalized)) return "admin";
  if (config.intakeOwnerEmails.includes(normalized)) return "intake_owner";
  if (config.devopsLeadEmails.includes(normalized)) return "devops_lead";
  if (config.developerEmails.includes(normalized)) return "developer";

  // Explicit email allowlist overrides domain check
  if (config.allowedEmails.length > 0) {
    return config.allowedEmails.includes(normalized) ? config.defaultRole : null;
  }

  // Domain allowlist
  if (config.allowedDomains.length > 0) {
    return config.allowedDomains.includes(domain) ? config.defaultRole : null;
  }

  // No restrictions configured — allow all
  return config.defaultRole;
}

export function resolveRoleConfigFromEnv(): RoleResolverConfig {
  return {
    adminEmails: parseEmailList(process.env.AUTH_ADMIN_EMAILS),
    intakeOwnerEmails: parseEmailList(process.env.AUTH_INTAKE_OWNER_EMAILS),
    devopsLeadEmails: parseEmailList(process.env.AUTH_DEVOPS_LEAD_EMAILS),
    developerEmails: parseEmailList(process.env.AUTH_DEVELOPER_EMAILS),
    allowedEmails: parseEmailList(process.env.AUTH_ALLOWED_EMAILS),
    allowedDomains: parseEmailList(process.env.AUTH_ALLOWED_DOMAINS),
    defaultRole: (process.env.AUTH_DEFAULT_ROLE ?? "request_creator") as UserRole,
  };
}

function parseEmailList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

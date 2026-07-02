import type { UserRole } from "../../../../../src/domain/types.js";

export type AuthProvider = "google" | "dev_headers" | "service_token";

export interface AuthenticatedActor {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authProvider: AuthProvider;
  authSubject?: string;
}

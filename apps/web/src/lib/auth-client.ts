const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export type AuthMode = "dev_headers" | "google";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  authMode: AuthMode;
  user?: AuthUser;
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch(`${BASE}/auth/me`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return { authenticated: false, authMode: "dev_headers" };
  return res.json() as Promise<AuthMeResponse>;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export function getGoogleLoginUrl(): string {
  return `${BASE}/auth/google/start`;
}

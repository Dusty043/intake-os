import type { UiActor } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev_headers";

export function actorHeaders(actor: UiActor): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH_MODE !== "google") {
    base["x-actor-id"] = actor.id;
    base["x-actor-role"] = actor.role;
    base["x-actor-name"] = actor.name;
  }
  return base;
}

export async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.message ?? body?.error ?? msg;
    } catch {
      // keep default
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export { BASE };

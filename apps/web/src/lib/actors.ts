import type { UiActor } from "./types";

export const ACTORS: UiActor[] = [
  { id: "actor_request_creator", name: "Request Creator", role: "request_creator" },
  { id: "actor_intake_owner", name: "Intake Owner", role: "intake_owner" },
  { id: "actor_devops_lead", name: "DevOps Lead", role: "devops_lead" },
  { id: "actor_admin", name: "Admin", role: "admin" },
  { id: "actor_developer", name: "Developer", role: "developer" },
];

export const DEFAULT_ACTOR = ACTORS[0];

export const ACTOR_STORAGE_KEY = "intake-os-actor";

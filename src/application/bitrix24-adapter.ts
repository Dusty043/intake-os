import type { CreateIntakeInput } from "./types.js";
import type { ProjectType } from "../domain/types.js";

export interface Bitrix24NormalizedIntake extends CreateIntakeInput {
  source: {
    system: "bitrix24";
    externalId?: string;
    externalUrl?: string;
    rawPayload: Record<string, unknown>;
  };
}

export function normalizeBitrix24IntakePayload(payload: Record<string, unknown>): Bitrix24NormalizedIntake {
  const id = firstString(payload, ["ID", "id", "dealId", "taskId", "entityId"]);
  const title = firstString(payload, ["TITLE", "title", "NAME", "name", "SUBJECT", "subject"]);
  const description = firstString(payload, ["COMMENTS", "comments", "DESCRIPTION", "description", "DETAIL_TEXT", "detailText"]);
  const requester = firstString(payload, ["CONTACT_NAME", "contactName", "CREATED_BY_NAME", "createdByName", "ASSIGNED_BY_NAME", "assignedByName"]);
  const department = firstString(payload, ["DEPARTMENT", "department", "UF_DEPARTMENT", "ufDepartment"]);
  const projectTypeCandidate = firstString(payload, ["PROJECT_TYPE", "projectType", "UF_PROJECT_TYPE", "ufProjectType"]);

  return {
    title: title || `Bitrix24 Intake ${id ?? "Unnumbered"}`,
    description: description || "No Bitrix24 description was provided. Discovery is required before approval.",
    requester: requester || "Bitrix24 requester unknown",
    department: department || undefined,
    projectType: normalizeProjectType(projectTypeCandidate),
    source: {
      system: "bitrix24",
      externalId: id || undefined,
      externalUrl: firstString(payload, ["URL", "url", "LINK", "link"]) || undefined,
      rawPayload: payload,
    },
  };
}

function firstString(payload: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function normalizeProjectType(value: string | null): ProjectType {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  switch (normalized) {
    case "n8n_automation":
    case "automation":
      return "n8n_automation";
    case "data_sync_integration":
    case "integration":
    case "data_integration":
      return "data_sync_integration";
    case "internal_dashboard":
    case "dashboard":
      return "internal_dashboard";
    case "client_portal":
    case "portal":
      return "client_portal";
    case "saas_platform":
    case "saas":
      return "saas_platform";
    case "api_service":
    case "api":
      return "api_service";
    case "ai_workflow_tool":
    case "ai_tool":
      return "ai_workflow_tool";
    case "discovery_research":
    case "research":
      return "discovery_research";
    case "reporting_automation":
    case "reporting":
      return "reporting_automation";
    case "internal_tool":
    case "tool":
    default:
      return "internal_tool";
  }
}

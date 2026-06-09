import type { ProjectIntakeRecord } from "./types";

export type BadgeVariant =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "ai"
  | "reviewed"
  | "preview";

export type StatusInfo = { label: string; variant: BadgeVariant };

const STATUS_MAP: Record<string, StatusInfo> = {
  draft:                { label: "Draft",                 variant: "neutral"  },
  submitted:            { label: "Submitted",             variant: "info"     },
  evaluating:           { label: "AI Draft Running",      variant: "ai"       },
  clarification_required: { label: "Clarification Needed", variant: "warning" },
  intake_review:        { label: "Review In Progress",    variant: "warning"  },
  devops_review:        { label: "Gate 1 Approved",       variant: "info"     },
  approved:             { label: "Approved",              variant: "success"  },
  provisioning:         { label: "Provisioning",          variant: "info"     },
  distributed:          { label: "Distributed",           variant: "success"  },
  provisioning_failed:  { label: "Failed",                variant: "danger"   },
  archived:             { label: "Archived",              variant: "neutral"  },
};

export function getStatusInfo(status: string): StatusInfo {
  return STATUS_MAP[status] ?? { label: status, variant: "neutral" };
}

export function getComputedBadges(record: ProjectIntakeRecord): StatusInfo[] {
  const badges: StatusInfo[] = [];
  if (record.latestAnalysisDraft && !record.reviewedProjectPackage) {
    badges.push({ label: "AI Draft Available", variant: "ai" });
  }
  if (record.reviewedProjectPackage) {
    badges.push({ label: "Reviewed", variant: "reviewed" });
  }
  if (record.provisioningPlan) {
    badges.push({ label: "Distribution Preview Ready", variant: "preview" });
  }
  return badges;
}

export const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral:  "bg-gray-100 text-gray-700 border border-gray-200",
  info:     "bg-blue-50 text-blue-700 border border-blue-200",
  warning:  "bg-amber-50 text-amber-700 border border-amber-200",
  success:  "bg-green-50 text-green-700 border border-green-200",
  danger:   "bg-red-50 text-red-700 border border-red-200",
  ai:       "bg-violet-50 text-violet-700 border border-violet-200",
  reviewed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  preview:  "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

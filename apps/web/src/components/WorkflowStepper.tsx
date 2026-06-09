import type { ProjectIntakeRecord } from "@/lib/types";

const STEPS = [
  { key: "submitted",    label: "Submitted"            },
  { key: "ai_draft",     label: "AI Draft"             },
  { key: "reviewed",     label: "Reviewed"             },
  { key: "gate_1",       label: "Gate 1"               },
  { key: "gate_2",       label: "Gate 2"               },
  { key: "distribution", label: "Distribution Preview" },
];

const TERMINAL = ["submitted", "evaluating", "clarification_required", "intake_review", "devops_review", "approved", "provisioning", "distributed"];

function getStepState(
  stepKey: string,
  record: ProjectIntakeRecord,
): "complete" | "current" | "pending" {
  const s = record.status;
  const laterStatuses = ["devops_review", "approved", "provisioning", "distributed"];
  const approvedOrLater = ["approved", "provisioning", "distributed"];

  switch (stepKey) {
    case "submitted":
      return TERMINAL.includes(s) ? "complete" : "current";
    case "ai_draft":
      if (record.latestAnalysisDraft) return "complete";
      if (["intake_review"].includes(s)) return "current";
      return "pending";
    case "reviewed":
      if (record.reviewedProjectPackage) return "complete";
      if (record.latestAnalysisDraft && s === "intake_review") return "current";
      return "pending";
    case "gate_1":
      if (laterStatuses.includes(s)) return "complete";
      if (s === "devops_review" || (record.reviewedProjectPackage && s === "intake_review")) return "current";
      return "pending";
    case "gate_2":
      if (approvedOrLater.includes(s)) return "complete";
      if (s === "devops_review") return "current";
      return "pending";
    case "distribution":
      if (record.provisioningPlan) return "complete";
      if (approvedOrLater.includes(s)) return "current";
      return "pending";
    default:
      return "pending";
  }
}

type Props = { record: ProjectIntakeRecord };

export function WorkflowStepper({ record }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
        const state = getStepState(step.key, record);
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${state === "complete" ? "bg-indigo-600 text-white" : ""}
                  ${state === "current"  ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500" : ""}
                  ${state === "pending"  ? "bg-gray-100 text-gray-400" : ""}
                `}
                aria-label={`${step.label}: ${state}`}
              >
                {state === "complete" ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap
                  ${state === "complete" ? "text-indigo-600 font-medium" : ""}
                  ${state === "current"  ? "text-indigo-700 font-semibold" : ""}
                  ${state === "pending"  ? "text-gray-400" : ""}
                `}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 mx-1 shrink-0 mt-[-12px]
                  ${state === "complete" ? "bg-indigo-600" : "bg-gray-200"}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

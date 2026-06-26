"use client";

import type { DiscoveryStatus, DiscoveryTimelineEvent } from "@/lib/discovery-types";

const STATUS_STEPS: { key: DiscoveryStatus; label: string }[] = [
  { key: "draft",                label: "Started"            },
  { key: "conversation_started", label: "Conversation"       },
  { key: "intent_detected",      label: "Intent Detected"    },
  { key: "problem_framed",       label: "Problem Framed"     },
  { key: "solutions_generated",  label: "Solutions"          },
  { key: "clarification_needed", label: "Clarification"      },
  { key: "direction_selected",   label: "Direction Selected" },
  { key: "proposal_generated",   label: "Proposal Ready"     },
  { key: "evaluation_ready",     label: "Evaluation Ready"   },
  { key: "sent_to_evaluation",   label: "Sent to Evaluation" },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  currentStatus: DiscoveryStatus;
  timeline: DiscoveryTimelineEvent[];
};

export function DiscoveryTimeline({ currentStatus, timeline }: Props) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);

  // Build a map of status → timeline event for lookup
  const eventMap = new Map<string, DiscoveryTimelineEvent>();
  for (const event of timeline) {
    eventMap.set(event.status, event);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="section-label mb-0">Discovery Timeline</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ol className="relative space-y-0">
          {STATUS_STEPS.map((step, idx) => {
            const isPast = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isFuture = idx > currentIndex;
            const event = eventMap.get(step.key);

            return (
              <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                {/* Connector line */}
                {idx < STATUS_STEPS.length - 1 && (
                  <div
                    className={`absolute left-[11px] top-5 bottom-0 w-0.5 ${
                      isPast ? "bg-indigo-300" : "bg-gray-200"
                    }`}
                  />
                )}

                {/* Dot */}
                <div className="relative flex-shrink-0 mt-0.5">
                  {isPast ? (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 ring-4 ring-indigo-100 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white" />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      isCurrent
                        ? "text-indigo-700"
                        : isPast
                        ? "text-gray-700"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {event && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatTime(event.occurredAt)}</p>
                  )}
                  {event?.note && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">{event.note}</p>
                  )}
                  {isFuture && (
                    <p className="text-xs text-gray-300 mt-0.5">Pending</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

"use client";

import type {
  DiscoveryConfidence,
  DiscoveryIntent,
  DiscoveryProblemFrame,
  SolutionOption,
} from "@/lib/discovery-types";

// ─── Confidence Bar ───────────────────────────────────────────────────────────

type ConfidenceBarProps = { label: string; value: number };

function ConfidenceBar({ label, value }: ConfidenceBarProps) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";

  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-medium text-gray-700">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Solution Card ────────────────────────────────────────────────────────────

const COMPLEXITY_BADGE: Record<string, string> = {
  low:    "bg-green-100 text-green-700 border-green-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high:   "bg-red-100   text-red-700   border-red-200",
};

type SolutionCardProps = {
  solution: SolutionOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
  disabled: boolean;
};

function SolutionCard({ solution, isSelected, onSelect, disabled }: SolutionCardProps) {
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${
        isSelected
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-200 bg-white hover:border-indigo-300"
      }`}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{solution.title}</span>
            {solution.isRecommended && (
              <span className="text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                Recommended
              </span>
            )}
            <span
              className={`text-xs font-medium border px-1.5 py-0.5 rounded ${
                COMPLEXITY_BADGE[solution.complexity] ?? COMPLEXITY_BADGE.medium
              }`}
            >
              {solution.complexity}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">{solution.summary}</p>

      {solution.expectedUpside && (
        <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mb-2">
          {solution.expectedUpside}
        </p>
      )}

      {!isSelected && (
        <button
          onClick={() => onSelect(solution.id)}
          disabled={disabled}
          className="btn-primary w-full py-1.5 text-xs justify-center"
        >
          Select this direction
        </button>
      )}

      {isSelected && (
        <div className="text-xs font-medium text-indigo-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
            <path
              d="M3 8l4 4 6-6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Direction selected
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = {
  intent: DiscoveryIntent | null;
  problemFrame: DiscoveryProblemFrame | null;
  confidence: DiscoveryConfidence;
  solutionOptions: SolutionOption[];
  selectedSolutionId: string | null;
  busy: boolean;
  onSelectDirection: (solutionId: string) => Promise<void>;
};

export function DiscoveryUnderstanding({
  intent,
  problemFrame,
  confidence,
  solutionOptions,
  selectedSolutionId,
  busy,
  onSelectDirection,
}: Props) {
  const CONFIDENCE_DIMS: Array<{ key: keyof DiscoveryConfidence; label: string }> = [
    { key: "problemUnderstanding", label: "Problem Understanding" },
    { key: "solutionFit",          label: "Solution Fit"          },
    { key: "scopeClarity",         label: "Scope Clarity"         },
    { key: "technicalFeasibility", label: "Technical Feasibility" },
    { key: "stakeholderClarity",   label: "Stakeholder Clarity"   },
    { key: "downstreamMapping",    label: "Downstream Mapping"    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="section-label mb-0">AI Understanding</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        {/* Confidence */}
        <section>
          <p className="section-label">Confidence</p>
          <div className="space-y-2">
            {CONFIDENCE_DIMS.map(({ key, label }) => (
              <ConfidenceBar key={key} label={label} value={confidence?.[key] ?? 0} />
            ))}
          </div>
        </section>

        {/* Intent */}
        {intent && (
          <section>
            <p className="section-label">Detected Intent</p>
            <div className="card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                  {intent.intentType}
                </span>
                {intent.solutionBiasDetected && (
                  <span className="text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                    Solution Bias
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{intent.underlyingProblem}</p>
              {intent.solutionBiasNote && (
                <p className="text-xs text-amber-700 italic">{intent.solutionBiasNote}</p>
              )}
            </div>
          </section>
        )}

        {/* Problem Frame */}
        {problemFrame && (
          <section>
            <p className="section-label">Problem Frame</p>
            <div className="card p-3 space-y-2">
              <p className="text-xs font-medium text-gray-800">{problemFrame.problemStatement}</p>

              {problemFrame.affectedUsers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Affected Users</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {problemFrame.affectedUsers.map((u, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-gray-400 shrink-0">·</span>
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {problemFrame.painPoints.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Pain Points</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {problemFrame.painPoints.map((p, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-red-400 shrink-0">·</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {problemFrame.unknowns.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Unknowns</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {problemFrame.unknowns.map((u, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-amber-400 shrink-0">?</span>
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Solution Options */}
        {solutionOptions.length > 0 && (
          <section>
            <p className="section-label">Solution Options</p>
            <div className="space-y-2">
              {solutionOptions.map((s) => (
                <SolutionCard
                  key={s.id}
                  solution={s}
                  isSelected={s.id === selectedSolutionId}
                  onSelect={onSelectDirection}
                  disabled={busy || !!selectedSolutionId}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!intent && !problemFrame && solutionOptions.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-4">
            <p>The AI will summarise its understanding here as the conversation progresses.</p>
          </div>
        )}
      </div>
    </div>
  );
}

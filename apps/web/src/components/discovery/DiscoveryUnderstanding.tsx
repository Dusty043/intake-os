"use client";

import type {
  DiscoveryConfidence,
  DiscoveryIntent,
  DiscoveryManifest,
  DiscoveryProblemFrame,
  DiscoveryProposal,
  DiscoveryStatus,
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
  status: DiscoveryStatus;
  intent: DiscoveryIntent | null;
  problemFrame: DiscoveryProblemFrame | null;
  confidence: DiscoveryConfidence;
  solutionOptions: SolutionOption[];
  selectedSolutionId: string | null;
  proposal: DiscoveryProposal | null;
  manifest: DiscoveryManifest | null;
  busy: boolean;
  onSelectDirection: (solutionId: string) => Promise<void>;
  onGenerateProposal: () => Promise<void>;
  onGenerateManifest: () => Promise<void>;
  onSendToEvaluation: () => Promise<void>;
};

export function DiscoveryUnderstanding({
  status,
  intent,
  problemFrame,
  confidence,
  solutionOptions,
  selectedSolutionId,
  proposal,
  manifest,
  busy,
  onSelectDirection,
  onGenerateProposal,
  onGenerateManifest,
  onSendToEvaluation,
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
              <ConfidenceBar key={key} label={label} value={confidence[key]} />
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

        {/* Proposal */}
        {proposal && (
          <section>
            <p className="section-label">Proposal</p>
            <div className="card p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-800">{proposal.title}</p>

              {proposal.suggestedEpics.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Suggested Epics</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {proposal.suggestedEpics.map((e, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-indigo-400 shrink-0">▸</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {proposal.unknowns.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Open Unknowns</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {proposal.unknowns.map((u, i) => (
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

        {/* Manifest */}
        {manifest && (
          <section>
            <p className="section-label">Manifest</p>
            <div className="card p-3 space-y-3">
              {/* Action badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</span>
                <span className="text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                  {manifest.recommendedAction.replace(/_/g, " ")}
                </span>
              </div>

              {/* Monday summary */}
              {(manifest.monday.roadmapEpics.length > 0 || manifest.monday.projectsPortfolio) && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Monday</p>
                  {manifest.monday.projectsPortfolio && (
                    <div className="space-y-0.5 mb-1">
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">Project:</span>{" "}
                        {manifest.monday.projectsPortfolio.name}
                        <span className="text-gray-400 ml-1">
                          ({manifest.monday.projectsPortfolio.projectType})
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Status:</span>{" "}
                        {manifest.monday.projectsPortfolio.status}
                      </p>
                      {manifest.monday.projectsPortfolio.techStack.length > 0 && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Stack:</span>{" "}
                          {manifest.monday.projectsPortfolio.techStack.join(", ")}
                        </p>
                      )}
                      {manifest.monday.projectsPortfolio.startDate && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Start:</span>{" "}
                          {manifest.monday.projectsPortfolio.startDate}
                        </p>
                      )}
                      {manifest.monday.projectsPortfolio.targetLaunch && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Target launch:</span>{" "}
                          {manifest.monday.projectsPortfolio.targetLaunch}
                        </p>
                      )}
                    </div>
                  )}
                  {manifest.monday.roadmapEpics.length > 0 && (
                    <div className="space-y-0.5">
                      {manifest.monday.roadmapEpics.map((epic, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                          <span className="flex gap-1.5">
                            <span className="text-indigo-400 shrink-0">▸</span>
                            <span className="truncate">{epic.title}</span>
                          </span>
                          {epic.estimatedSP && (
                            <span className="shrink-0 ml-1 text-gray-400">{epic.estimatedSP} SP</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {manifest.monday.sprintTasks.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      + {manifest.monday.sprintTasks.length} task{manifest.monday.sprintTasks.length !== 1 ? "s" : ""} → Backlog
                    </p>
                  )}
                </div>
              )}

              {/* GitHub summary */}
              {manifest.github.createRepo && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">GitHub</p>
                  <p className="text-xs text-gray-700">
                    <span className="font-medium">Repo:</span>{" "}
                    <span className="font-mono">{manifest.github.repoName}</span>
                  </p>
                  {manifest.github.readme && (
                    <p className="text-xs text-gray-500 mt-0.5">README · {manifest.github.labels.length} labels · {manifest.github.initialIssues.length} issues</p>
                  )}
                </div>
              )}

              {!manifest.readyForLiveAdapter && (
                <p className="text-xs text-amber-600">
                  Mock manifest — live adapter not yet connected
                </p>
              )}
            </div>

            <button
              onClick={onSendToEvaluation}
              disabled={busy || status === "sent_to_evaluation"}
              className="btn-primary w-full mt-2 justify-center"
            >
              {status === "sent_to_evaluation" ? "Sent to Evaluation" : "Send to Evaluation"}
            </button>
          </section>
        )}

        {/* Action buttons for progression */}
        {selectedSolutionId && !proposal && status !== "proposal_generated" && (
          <button
            onClick={onGenerateProposal}
            disabled={busy}
            className="btn-secondary w-full justify-center text-sm"
          >
            {busy ? "Generating proposal…" : "Generate Proposal"}
          </button>
        )}

        {proposal && !manifest && status !== "evaluation_ready" && status !== "sent_to_evaluation" && (
          <button
            onClick={onGenerateManifest}
            disabled={busy}
            className="btn-secondary w-full justify-center text-sm"
          >
            {busy ? "Generating manifest…" : "Generate Manifest"}
          </button>
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

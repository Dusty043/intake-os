"use client";

import React, { useState } from "react";
import type { AgentRun, IntakeEvaluation, QualityReadinessBand, QualityScore } from "@/lib/types";
import { EvaluationSectionTabs } from "./EvaluationSectionCard";

// ─── Quality score badge ──────────────────────────────────────────────────────

const BAND_STYLE: Record<QualityReadinessBand, string> = {
  ready:          "bg-emerald-100 text-emerald-800 border-emerald-200",
  usable:         "bg-blue-100 text-blue-800 border-blue-200",
  needs_revision: "bg-amber-100 text-amber-800 border-amber-200",
  not_ready:      "bg-red-100 text-red-800 border-red-200",
};

function QualityScoreBadge({ score }: { score: QualityScore }) {
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full border ${BAND_STYLE[score.readinessBand]}`}>
      {score.overall} · {score.readinessBand.replace("_", " ")}
    </span>
  );
}

function QualityScoreBreakdown({ score }: { score: QualityScore }) {
  const dims = [
    { key: "completeness",     label: "Completeness" },
    { key: "consistency",      label: "Consistency" },
    { key: "specificity",      label: "Specificity" },
    { key: "feasibility",      label: "Feasibility" },
    { key: "riskCoverage",     label: "Risk Coverage" },
    { key: "handoffReadiness", label: "Handoff Readiness" },
  ] as const;

  return (
    <div className="space-y-2">
      {dims.map(({ key, label }) => {
        const val = score.dimensions[key];
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-36 text-xs text-gray-500">{label}</span>
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${val >= 80 ? "bg-emerald-400" : val >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                style={{ width: `${val}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs font-mono text-gray-500">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Evaluation summary card ──────────────────────────────────────────────────

function EvaluationSummaryCard({ evaluation }: { evaluation: IntakeEvaluation }) {
  const activeSections = evaluation.sections.filter((s) => !s.supersededById);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-brand-text mb-1">Evaluation Packet</h3>
          <p className="text-xs text-gray-400 font-mono">{evaluation.id}</p>
        </div>
        {evaluation.qualityScore && (
          <QualityScoreBadge score={evaluation.qualityScore} />
        )}
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Depth</dt>
          <dd className="text-brand-text capitalize">{evaluation.depth}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Status</dt>
          <dd className="text-brand-text">{evaluation.status.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Sections</dt>
          <dd className="text-brand-text">{activeSections.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Version</dt>
          <dd className="text-brand-text">v{evaluation.evaluationVersion}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Generated</dt>
          <dd className="text-brand-text">{new Date(evaluation.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">By</dt>
          <dd className="text-brand-text">{evaluation.createdBy.displayName ?? evaluation.createdBy.id}</dd>
        </div>
      </dl>

      {evaluation.qualityScore && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Score Breakdown</p>
          <QualityScoreBreakdown score={evaluation.qualityScore} />
        </div>
      )}

      <p className="text-xs text-gray-400 italic">
        This evaluation was mapped into the current AI draft for human review.
      </p>
    </div>
  );
}

// ─── Regenerate form ──────────────────────────────────────────────────────────

function EvaluationRegenerateForm({
  disabled,
  reason,
  defaultGuidance,
  onSubmit,
}: {
  disabled: boolean;
  reason?: string;
  defaultGuidance?: string;
  onSubmit: (guidance: string) => Promise<void>;
}) {
  const [guidance, setGuidance] = useState(defaultGuidance ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (guidance.trim().length < 10) {
      setErr("Guidance must be at least 10 characters.");
      return;
    }
    if (guidance.trim().length > 4000) {
      setErr("Guidance must be 4000 characters or fewer.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(guidance.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-brand-text">Regenerate analysis with guidance</h3>
        <p className="text-xs text-gray-500 mt-1">
          This reruns the evaluation pipeline and creates a new reviewable draft. It does not approve the intake.
        </p>
      </div>

      {disabled && reason && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{reason}</p>
      )}

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="space-y-2">
        <label className="form-label">
          Guidance <span className="text-gray-400">(min 10 chars, max 4000)</span>
        </label>
        <textarea
          className="form-textarea h-20"
          value={guidance}
          onChange={(e) => { setGuidance(e.target.value); setErr(null); }}
          placeholder="Describe what the AI should focus on, change, or reconsider…"
          disabled={disabled || busy}
        />
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{guidance.length}/4000</span>
        </div>
        <button
          className="btn-secondary"
          disabled={disabled || busy || guidance.trim().length < 10}
          onClick={() => { void handleSubmit(); }}
        >
          {busy ? "Regenerating…" : "Regenerate analysis"}
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EvaluationEmptyState() {
  return (
    <div className="card p-12 text-center">
      <p className="text-brand-muted font-medium">No evaluation has been generated for this intake yet.</p>
      <p className="text-gray-400 text-sm mt-1">Generate analysis to create the evaluation packet.</p>
    </div>
  );
}

// ─── EvaluationPanel ─────────────────────────────────────────────────────────

export type EvaluationPanelProps = {
  evaluation: IntakeEvaluation | null;
  agentRuns?: AgentRun[];
  loading?: boolean;
  error?: string | null;
  canRegenerateAnalysis: boolean;
  regenerateDisabledReason?: string;
  onRegenerateAnalysis?: (guidance: string) => Promise<void>;
};

export function EvaluationPanel({
  evaluation,
  agentRuns,
  loading,
  error,
  canRegenerateAnalysis,
  regenerateDisabledReason,
  onRegenerateAnalysis,
}: EvaluationPanelProps) {
  const [regenGuidancePrefill, setRegenGuidancePrefill] = useState<string | undefined>(undefined);

  if (loading) {
    return <div className="card p-12 text-center text-brand-muted text-sm">Loading evaluation…</div>;
  }

  if (error) {
    return (
      <div className="card p-5 bg-red-50 border border-red-200 text-red-800 text-sm">
        Failed to load evaluation: {error}
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="space-y-4">
        <EvaluationEmptyState />
        {onRegenerateAnalysis && (
          <EvaluationRegenerateForm
            disabled={!canRegenerateAnalysis}
            reason={regenerateDisabledReason}
            onSubmit={onRegenerateAnalysis}
          />
        )}
      </div>
    );
  }

  const activeSections = evaluation.sections.filter((s) => !s.supersededById);
  const warnings = activeSections.flatMap((s) => s.provenance.warnings ?? []);

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-200 text-violet-800 rounded-lg px-4 py-3 text-sm">
        <strong>Multi-agent evaluation packet.</strong> This packet explains the reasoning behind the mapped AI draft. Accept or revise the AI draft for the human review step.
      </div>

      <EvaluationSummaryCard evaluation={evaluation} />

      {warnings.length > 0 && (
        <div className="card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-amber-800">Warnings ({warnings.length})</h3>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠ {w}</p>
          ))}
        </div>
      )}

      {activeSections.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-brand-text mb-3">
            Sections ({activeSections.length})
          </h3>
          <EvaluationSectionTabs
            sections={activeSections}
            agentRuns={agentRuns}
            onUseAsGuidance={canRegenerateAnalysis && onRegenerateAnalysis ? setRegenGuidancePrefill : undefined}
          />
        </div>
      )}

      {onRegenerateAnalysis && (
        <EvaluationRegenerateForm
          disabled={!canRegenerateAnalysis}
          reason={regenerateDisabledReason}
          defaultGuidance={regenGuidancePrefill}
          onSubmit={onRegenerateAnalysis}
        />
      )}
    </div>
  );
}

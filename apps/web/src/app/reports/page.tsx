"use client";

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  getAiUsageSummary,
  getIntakePipelineSummary,
  listIntakes,
} from "@/lib/api-client";
import type { ProjectIntakeRecord } from "@/lib/types";

type PipelineSummary = Awaited<ReturnType<typeof getIntakePipelineSummary>>;
type AiSummary = Awaited<ReturnType<typeof getAiUsageSummary>>;

const STATUS_ORDER = [
  "draft", "submitted", "evaluating", "clarification_required",
  "intake_review", "devops_review", "approved", "provisioning",
  "distributed", "in_progress", "blocked", "completed", "canceled",
  "provisioning_failed", "archived",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-50 text-blue-700",
  evaluating: "bg-violet-50 text-violet-700",
  clarification_required: "bg-amber-50 text-amber-700",
  intake_review: "bg-orange-50 text-orange-700",
  devops_review: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-50 text-emerald-700",
  provisioning: "bg-teal-50 text-teal-700",
  distributed: "bg-indigo-50 text-indigo-700",
  in_progress: "bg-indigo-100 text-indigo-800",
  blocked: "bg-red-50 text-red-600",
  completed: "bg-green-100 text-green-800",
  canceled: "bg-gray-200 text-gray-500",
  provisioning_failed: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-400",
};

function fmt(cost: number) { return `$${cost.toFixed(4)}`; }
function fmtTokens(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k`
    : String(n);
}

export default function ReportsPage() {
  const { actor } = useActor();
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [recent, setRecent] = useState<ProjectIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, ai, all] = await Promise.all([
        getIntakePipelineSummary(actor),
        getAiUsageSummary(actor, month).catch(() => null),
        listIntakes(actor),
      ]);
      setPipeline(p);
      setAiSummary(ai);
      setRecent(all.slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [actor, month]);

  useEffect(() => { void load(); }, [load]);

  const orderedStatuses = pipeline
    ? STATUS_ORDER.filter((s) => (pipeline.byStatus[s] ?? 0) > 0)
    : [];

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">Reports</h1>
          <p className="text-sm text-brand-muted mt-0.5">
            Pipeline health and AI cost overview.
          </p>
        </div>
        <button onClick={load} className="btn-secondary" aria-label="Refresh">
          Refresh
        </button>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="card p-12 text-center text-brand-muted text-sm">Loading…</div>
      ) : (
        <>
          {/* Pipeline summary */}
          {pipeline && (
            <section>
              <h2 className="text-base font-semibold text-brand-text mb-3">
                Intake Pipeline
                <span className="ml-2 text-sm font-normal text-brand-muted">
                  {pipeline.total} total
                </span>
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {orderedStatuses.map((status) => (
                  <div key={status} className="card p-3 space-y-1">
                    <p className="text-xl font-semibold font-mono text-brand-text">
                      {pipeline.byStatus[status]}
                    </p>
                    <span
                      className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
                {orderedStatuses.length === 0 && (
                  <p className="col-span-5 text-brand-muted text-sm">No intakes yet.</p>
                )}
              </div>
            </section>
          )}

          {/* AI cost this month */}
          {aiSummary && (
            <section>
              <h2 className="text-base font-semibold text-brand-text mb-3">
                AI Cost — {aiSummary.month}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <StatCard label="Est. Cost" value={fmt(aiSummary.totalCostUsd)} />
                <StatCard label="Tokens" value={fmtTokens(aiSummary.totalTokens)} />
                <StatCard label="Agent Runs" value={String(aiSummary.runCount)} />
                <StatCard
                  label="Avg / Run"
                  value={aiSummary.runCount > 0 ? fmt(aiSummary.totalCostUsd / aiSummary.runCount) : "—"}
                />
              </div>
              {Object.keys(aiSummary.byModel).length > 0 && (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-border bg-brand-surface text-brand-muted text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Model</th>
                        <th className="px-4 py-3 text-right">Runs</th>
                        <th className="px-4 py-3 text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {Object.entries(aiSummary.byModel)
                        .sort(([, a], [, b]) => b.costUsd - a.costUsd)
                        .map(([model, d]) => (
                          <tr key={model} className="hover:bg-brand-surface/50">
                            <td className="px-4 py-3 font-mono text-xs">{model}</td>
                            <td className="px-4 py-3 text-right text-brand-muted">{d.count}</td>
                            <td className="px-4 py-3 text-right font-mono">{fmt(d.costUsd)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Recent intakes */}
          {recent.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-brand-text mb-3">Recent Intakes</h2>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-surface text-brand-muted text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Title</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {recent.map((intake) => (
                      <tr key={intake.id} className="hover:bg-brand-surface/50">
                        <td className="px-4 py-3 font-medium truncate max-w-[200px]">
                          {intake.title}
                        </td>
                        <td className="px-4 py-3 text-brand-muted text-xs">
                          {intake.projectType?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[intake.status] ?? "bg-gray-100 text-gray-500"}`}
                          >
                            {intake.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-brand-muted text-xs">
                          {typeof intake.createdAt === "string"
                            ? new Date(intake.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-semibold text-brand-text font-mono">{value}</p>
    </div>
  );
}

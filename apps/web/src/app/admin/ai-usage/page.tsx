"use client";

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getAiUsage, getAiUsageSummary } from "@/lib/api-client";

type UsageData = Awaited<ReturnType<typeof getAiUsage>>;
type SummaryData = Awaited<ReturnType<typeof getAiUsageSummary>>;

function fmt(cost: number) {
  return `$${cost.toFixed(4)}`;
}

function fmtTokens(n: number) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}k`
    : String(n);
}

export default function AiUsagePage() {
  const { actor } = useActor();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, s] = await Promise.all([
        getAiUsage(actor),
        getAiUsageSummary(actor, month),
      ]);
      setUsage(u);
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI usage data.");
    } finally {
      setLoading(false);
    }
  }, [actor, month]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-8 max-w-7xl space-y-8">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">AI Usage</h1>
          <p className="text-sm text-brand-muted mt-0.5">
            Estimated AI costs and token usage. All figures are estimates — not exact billing data.
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
          {/* Monthly summary */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-semibold text-brand-text">Monthly Summary</h2>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border border-brand-border rounded px-2 py-1 text-sm"
              />
            </div>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Cost (est.)" value={fmt(summary.totalCostUsd)} />
                <StatCard label="Total Tokens" value={fmtTokens(summary.totalTokens)} />
                <StatCard label="Agent Runs" value={String(summary.runCount)} />
                <StatCard
                  label="Avg Cost / Run"
                  value={summary.runCount > 0 ? fmt(summary.totalCostUsd / summary.runCount) : "—"}
                />
              </div>
            )}
          </section>

          {/* By model */}
          {summary && Object.keys(summary.byModel).length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-brand-text mb-3">Cost by Model</h2>
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
                    {Object.entries(summary.byModel)
                      .sort(([, a], [, b]) => b.costUsd - a.costUsd)
                      .map(([model, data]) => (
                        <tr key={model} className="hover:bg-brand-surface/50">
                          <td className="px-4 py-3 font-mono text-xs">{model}</td>
                          <td className="px-4 py-3 text-right text-brand-muted">{data.count}</td>
                          <td className="px-4 py-3 text-right font-mono">{fmt(data.costUsd)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* By source (intake evaluation vs. discovery) */}
          {summary?.bySource && Object.keys(summary.bySource).length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-brand-text mb-3">Cost by Source</h2>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-surface text-brand-muted text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Source</th>
                      <th className="px-4 py-3 text-right">Runs</th>
                      <th className="px-4 py-3 text-right">Tokens</th>
                      <th className="px-4 py-3 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {Object.entries(summary.bySource)
                      .sort(([, a], [, b]) => b.costUsd - a.costUsd)
                      .map(([source, data]) => (
                        <tr key={source} className="hover:bg-brand-surface/50">
                          <td className="px-4 py-3 capitalize">{source}</td>
                          <td className="px-4 py-3 text-right text-brand-muted">{data.count}</td>
                          <td className="px-4 py-3 text-right text-brand-muted">{fmtTokens(data.tokens)}</td>
                          <td className="px-4 py-3 text-right font-mono">{fmt(data.costUsd)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* By agent role */}
          {summary && Object.keys(summary.byAgentRole).length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-brand-text mb-3">Cost by Agent Role</h2>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-surface text-brand-muted text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Agent Role</th>
                      <th className="px-4 py-3 text-right">Runs</th>
                      <th className="px-4 py-3 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {Object.entries(summary.byAgentRole)
                      .sort(([, a], [, b]) => b.costUsd - a.costUsd)
                      .map(([role, data]) => (
                        <tr key={role} className="hover:bg-brand-surface/50">
                          <td className="px-4 py-3">{role.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-right text-brand-muted">{data.count}</td>
                          <td className="px-4 py-3 text-right font-mono">{fmt(data.costUsd)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* All-time totals */}
          {usage && (
            <section>
              <h2 className="text-base font-semibold text-brand-text mb-3">All-Time Totals</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total Cost (est.)" value={fmt(usage.totalCostUsd)} />
                <StatCard label="Total Tokens" value={fmtTokens(usage.totalTokens)} />
                <StatCard label="Total Runs" value={String(usage.runCount)} />
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { listIntakes, listProvisioningRuns, markProvisioningTargetResolved } from "@/lib/api-client";
import { formatDate } from "@/lib/formatting";
import type { ProjectIntakeRecord, ProvisioningRun, ProvisioningTargetResult } from "@/lib/types";

interface DeadLetteredTarget {
  intake: ProjectIntakeRecord;
  run: ProvisioningRun;
  target: ProvisioningTargetResult;
}

function ErrorCategoryBadge({ category }: { category?: string }) {
  if (!category) return null;
  const colors: Record<string, string> = {
    transient_api_error: "bg-yellow-100 text-yellow-800",
    rate_limit: "bg-orange-100 text-orange-800",
    auth_error: "bg-red-100 text-red-800",
    validation_error: "bg-purple-100 text-purple-800",
    collision: "bg-blue-100 text-blue-800",
    config_error: "bg-gray-100 text-gray-700",
    unknown: "bg-gray-100 text-gray-500",
  };
  const cls = colors[category] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {category.replace(/_/g, " ")}
    </span>
  );
}

export default function FailuresPage() {
  const { actor } = useActor();
  const [items, setItems] = useState<DeadLetteredTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const intakes = await listIntakes(actor);
      const failed = intakes.filter(
        (i) => i.status === "provisioning_failed" || i.status === "distributed",
      );

      const all: DeadLetteredTarget[] = [];
      await Promise.all(
        failed.map(async (intake) => {
          const runs = await listProvisioningRuns(intake.id, actor);
          for (const run of runs) {
            for (const target of run.targets) {
              if (target.deadLettered || (target.status === "failed" && !target.retryable)) {
                all.push({ intake, run, target });
              }
            }
          }
        }),
      );

      all.sort((a, b) => {
        const aDate = a.target.deadLetteredAt ?? a.run.completedAt ?? a.run.startedAt;
        const bDate = b.target.deadLetteredAt ?? b.run.completedAt ?? b.run.startedAt;
        return bDate.localeCompare(aDate);
      });

      setItems(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load failure data.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => { void load(); }, [load]);

  async function handleMarkResolved(item: DeadLetteredTarget) {
    setResolvingId(item.target.id);
    setError(null);
    try {
      await markProvisioningTargetResolved(item.intake.id, item.target.id, actor);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark as resolved.");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">Provisioning Failures</h1>
          <p className="text-sm text-brand-muted mt-0.5">
            Dead-lettered and permanently failed provisioning targets requiring manual action.
          </p>
        </div>
        <button onClick={load} className="btn-secondary" aria-label="Refresh">
          Refresh
        </button>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="card overflow-hidden mt-4">
        {loading ? (
          <div className="p-12 text-center text-brand-muted text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-brand-muted text-sm">
            No dead-lettered targets found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface text-brand-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Intake</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Error</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Attempts</th>
                <th className="px-4 py-3 text-left">Dead-lettered</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {items.map(({ intake, run, target }) => (
                <tr key={target.id} className="hover:bg-brand-surface/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/intakes/${intake.id}`}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      {intake.title}
                    </Link>
                    <div className="text-xs text-brand-muted mt-0.5">{intake.requester}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-brand-surface px-1.5 py-0.5 rounded">
                      {target.targetKind}
                    </span>
                    <div className="text-xs text-brand-muted mt-0.5">
                      run:{" "}
                      <span className="font-mono">{run.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="text-red-700 text-xs line-clamp-2">
                      {target.errorMessage ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ErrorCategoryBadge category={target.errorCategory} />
                  </td>
                  <td className="px-4 py-3 text-center text-brand-muted">
                    {target.attemptCount}
                  </td>
                  <td className="px-4 py-3 text-brand-muted text-xs">
                    {target.deadLetteredAt ? formatDate(target.deadLetteredAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleMarkResolved({ intake, run, target })}
                      disabled={resolvingId === target.id}
                      className="btn-secondary text-xs py-1 px-2 disabled:opacity-50"
                    >
                      {resolvingId === target.id ? "Resolving…" : "Mark Resolved"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { executeLifecycleTransition, listDistributedIntakes } from "@/lib/api-client";
import type { LifecycleAction } from "@/lib/api-client";
import { formatDate, formatProjectType } from "@/lib/formatting";
import { getStatusInfo } from "@/lib/status";
import type { ProjectIntakeRecord } from "@/lib/types";

const LIFECYCLE_ACTIONS: Record<
  string,
  { label: string; action: LifecycleAction; confirm?: string }[]
> = {
  distributed: [
    { label: "Mark Started", action: "mark_started" },
    { label: "Mark Blocked", action: "mark_blocked" },
    { label: "Cancel", action: "mark_canceled", confirm: "Cancel this project?" },
  ],
  in_progress: [
    { label: "Mark Blocked", action: "mark_blocked" },
    { label: "Mark Completed", action: "mark_completed" },
    { label: "Cancel", action: "mark_canceled", confirm: "Cancel this project?" },
  ],
  blocked: [
    { label: "Unblock", action: "unblock" },
    { label: "Mark Completed", action: "mark_completed" },
    { label: "Cancel", action: "mark_canceled", confirm: "Cancel this project?" },
  ],
  completed: [{ label: "Archive", action: "archive" }],
  canceled: [{ label: "Archive", action: "archive" }],
};


export default function DistributedPage() {
  const { actor } = useActor();
  const [intakes, setIntakes] = useState<ProjectIntakeRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDistributedIntakes(actor);
      setIntakes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load distributed projects.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(intake: ProjectIntakeRecord, action: LifecycleAction, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return;
    setActing(intake.id);
    try {
      await executeLifecycleTransition(intake.id, action, actor);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Action "${action}" failed.`);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distributed Projects</h1>
          <p className="text-sm text-gray-500 mt-1">Post-distribution lifecycle management</p>
        </div>
        <Link href="/intakes" className="text-sm text-blue-600 hover:underline">
          All Intakes
        </Link>
      </div>

      {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">Loading distributed projects...</div>
      )}

      {!loading && intakes && intakes.length === 0 && (
        <div className="text-sm text-gray-500 border border-dashed rounded p-8 text-center">
          No distributed projects yet.
        </div>
      )}

      {!loading && intakes && intakes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Project</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Updated</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {intakes.map((intake) => {
                const actions = LIFECYCLE_ACTIONS[intake.status] ?? [];
                const isActing = acting === intake.id;
                return (
                  <tr key={intake.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/intakes/${intake.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {intake.title}
                      </Link>
                      {intake.blockedReason && (
                        <p className="text-xs text-orange-600 mt-0.5">
                          Blocked: {intake.blockedReason}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {intake.projectType ? formatProjectType(intake.projectType) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {(() => { const si = getStatusInfo(intake.status); return <StatusBadge label={si.label} variant={si.variant} />; })()}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {intake.updatedAt ? formatDate(intake.updatedAt) : "—"}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2 flex-wrap">
                        {actions.map(({ label, action, confirm }) => (
                          <button
                            key={action}
                            disabled={isActing}
                            onClick={() => handleAction(intake, action, confirm)}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {label}
                          </button>
                        ))}
                        {actions.length === 0 && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

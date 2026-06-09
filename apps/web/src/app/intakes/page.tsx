"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { listIntakes } from "@/lib/api-client";
import { formatDate, formatProjectType } from "@/lib/formatting";
import { getStatusInfo } from "@/lib/status";
import type { ProjectIntakeRecord } from "@/lib/types";

export default function IntakesPage() {
  const { actor } = useActor();
  const [intakes, setIntakes] = useState<ProjectIntakeRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listIntakes(actor);
      setIntakes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load intakes.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">Active Intakes</h1>
          <p className="text-sm text-brand-muted mt-0.5">
            Manage and track project requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary" aria-label="Refresh intakes">
            Refresh
          </button>
          <Link href="/intakes/new" className="btn-primary">
            Create Intake
          </Link>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="card overflow-hidden mt-4">
        {loading ? (
          <div className="p-12 text-center text-brand-muted text-sm">
            Loading intakes…
          </div>
        ) : intakes && intakes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-brand-muted text-sm font-medium">No intakes yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Create the first project intake to begin the review workflow.
            </p>
            <Link href="/intakes/new" className="btn-primary mt-4 inline-flex">
              Create Intake
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["ID", "Title", "Project Type", "Status", "Requester", "Created", "Updated"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {intakes?.map((intake) => {
                  const si = getStatusInfo(intake.status);
                  return (
                    <tr
                      key={intake.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        <Link
                          href={`/intakes/${intake.id}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {intake.id.slice(0, 14)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/intakes/${intake.id}`}
                          className="font-medium text-brand-text hover:text-indigo-600"
                        >
                          {intake.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatProjectType(intake.projectType)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={si.label} variant={si.variant} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {intake.requester ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(intake.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(intake.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

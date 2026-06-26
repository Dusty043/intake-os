"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { DiscoveryStartModal } from "@/components/discovery/DiscoveryStartModal";
import { listDiscoverySessions, startDiscovery } from "@/lib/discovery-client";
import type { DiscoverySession, DiscoveryStatus } from "@/lib/discovery-types";
import { useAuth } from "@/components/AuthProvider";

const STATUS_LABELS: Record<DiscoveryStatus, string> = {
  draft:                "Draft",
  conversation_started: "Conversation",
  intent_detected:      "Intent Detected",
  problem_framed:       "Problem Framed",
  solutions_generated:  "Solutions Ready",
  clarification_needed: "Clarification Needed",
  direction_selected:   "Direction Selected",
  proposal_generated:   "Proposal Ready",
  evaluation_ready:     "Evaluation Ready",
  sent_to_evaluation:   "Sent to Evaluation",
};

const STATUS_COLOR: Record<DiscoveryStatus, string> = {
  draft:                "bg-gray-100 text-gray-600",
  conversation_started: "bg-blue-100 text-blue-700",
  intent_detected:      "bg-indigo-100 text-indigo-700",
  problem_framed:       "bg-indigo-100 text-indigo-700",
  solutions_generated:  "bg-purple-100 text-purple-700",
  clarification_needed: "bg-amber-100 text-amber-700",
  direction_selected:   "bg-teal-100 text-teal-700",
  proposal_generated:   "bg-green-100 text-green-700",
  evaluation_ready:     "bg-green-100 text-green-700",
  sent_to_evaluation:   "bg-emerald-100 text-emerald-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DiscoveryListPage() {
  const { actor } = useActor();
  const { user } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<DiscoverySession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);

  // Use auth user ID if available, fall back to actor ID
  const userId = user?.id ?? actor.id;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDiscoverySessions(userId, actor);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load discovery sessions.");
    } finally {
      setLoading(false);
    }
  }, [userId, actor]);

  useEffect(() => { void load(); }, [load]);

  const handleStart = async (message: string) => {
    const session = await startDiscovery(userId, message, actor);
    router.push(`/discovery/${session.id}`);
  };

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">Discovery Sessions</h1>
          <p className="text-sm text-brand-muted mt-0.5">
            AI-guided conversations to clarify project intent before intake.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary" aria-label="Refresh">
            Refresh
          </button>
          <button onClick={() => setShowStartModal(true)} className="btn-primary">
            + Start Discovery
          </button>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="card overflow-hidden mt-4">
        {loading ? (
          <div className="p-12 text-center text-brand-muted text-sm">
            Loading sessions…
          </div>
        ) : sessions && sessions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-brand-muted text-sm font-medium">No discovery sessions yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Start a guided AI conversation to clarify a project idea before submitting an intake.
            </p>
            <button
              onClick={() => setShowStartModal(true)}
              className="btn-primary mt-4 inline-flex"
            >
              + Start Discovery
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["ID", "Status", "Messages", "Last Activity"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions?.map((session) => {
                  const lastEvent = session.timeline[session.timeline.length - 1];
                  const lastMessage = session.messages[session.messages.length - 1];
                  const lastActivity =
                    lastEvent?.occurredAt ?? lastMessage?.createdAt ?? session.id;

                  return (
                    <tr
                      key={session.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        <Link
                          href={`/discovery/${session.id}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {session.id.slice(0, 14)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            STATUS_COLOR[session.status]
                          }`}
                        >
                          {STATUS_LABELS[session.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {session.messages.length}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(lastActivity)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showStartModal && (
        <DiscoveryStartModal
          onStart={handleStart}
          onClose={() => setShowStartModal(false)}
        />
      )}
    </div>
  );
}

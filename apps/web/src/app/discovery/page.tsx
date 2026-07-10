"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { DiscoveryStartModal } from "@/components/discovery/DiscoveryStartModal";
import { generateSolutions, listDiscoverySessions, startDiscovery } from "@/lib/discovery-client";
import type { DiscoverySession } from "@/lib/discovery-types";
import { useAuth } from "@/components/AuthProvider";
import { getDiscoveryStatusInfo } from "@/lib/status";
import { formatDateOnly } from "@/lib/formatting";
import { StatusBadge } from "@/components/StatusBadge";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateOnly(iso);
}

function getSessionTitle(session: DiscoverySession): string | null {
  if (session.problemFrame?.problemStatement) {
    const s = session.problemFrame.problemStatement;
    return s.length > 90 ? s.slice(0, 87) + "…" : s;
  }
  const firstMsg = session.messages.find((m) => m.role === "user");
  if (firstMsg?.content) {
    const s = firstMsg.content.trim();
    return s.length > 90 ? s.slice(0, 87) + "…" : s;
  }
  return null;
}

function getLinkedIntakeId(sessionId: string): string | null {
  try {
    return localStorage.getItem(`pit:discovery:intake:${sessionId}`);
  } catch {
    return null;
  }
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
    let session = await startDiscovery(message, actor);
    // Mirrors the same auto-chain in [id]/page.tsx's handleSendMessage — the
    // first message also lands in problem_framed with no solutions yet, and
    // nothing else triggers generateSolutions for a brand-new session.
    if (session.status === "problem_framed" && session.solutionOptions.length === 0) {
      session = await generateSolutions(session.id, actor);
    }
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
                  {["Session", "Status", "Last Activity"].map((h) => (
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
                  const title = getSessionTitle(session);
                  const linkedIntakeId = session.status === "sent_to_evaluation"
                    ? getLinkedIntakeId(session.id)
                    : null;

                  return (
                    <tr
                      key={session.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-md">
                        <Link
                          href={`/discovery/${session.id}`}
                          className="block text-brand-text hover:text-indigo-600 transition-colors font-medium leading-snug"
                        >
                          {title ?? (
                            <span className="font-mono text-xs text-gray-400">
                              {session.id.slice(0, 14)}…
                            </span>
                          )}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-gray-400">
                            {session.id.slice(0, 10)}…
                          </span>
                          {linkedIntakeId && (
                            <Link
                              href={`/intakes/${linkedIntakeId}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View intake →
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => { const s = getDiscoveryStatusInfo(session.status); return (
                          <StatusBadge label={s.label} variant={s.variant} />
                        ); })()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        <span title={formatDateOnly(lastActivity)}>
                          {formatRelativeTime(lastActivity)}
                        </span>
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

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { DiscoveryLayout } from "@/components/discovery/DiscoveryLayout";
import { DiscoveryTimeline } from "@/components/discovery/DiscoveryTimeline";
import { DiscoveryChat } from "@/components/discovery/DiscoveryChat";
import { DiscoveryUnderstanding } from "@/components/discovery/DiscoveryUnderstanding";
import {
  answerClarification,
  generateManifest,
  generateProposal,
  generateSolutions,
  getDiscoverySession,
  selectDirection,
  sendMessage,
  sendToEvaluation,
} from "@/lib/discovery-client";
import type { DiscoverySession } from "@/lib/discovery-types";

// Statuses where the AI is actively processing — poll until we leave these.
// intent_detected is intentionally excluded: it's a stable "waiting for user input"
// state, not a transient processing state. Polling it endlessly causes infinite loops.
const AI_PROCESSING_STATUSES = new Set([
  "draft",
  "conversation_started",
  "problem_framed",
  "direction_selected",
]);

export default function DiscoverySessionPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useActor();
  const router = useRouter();

  const [session, setSession] = useState<DiscoverySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkedIntakeId, setLinkedIntakeId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDiscoverySession(id, actor);
      setSession(data);
      if (data.status === "sent_to_evaluation") {
        try {
          setLinkedIntakeId(localStorage.getItem(`pit:discovery:intake:${id}`));
        } catch {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load discovery session.");
    } finally {
      setLoading(false);
    }
  }, [id, actor]);

  const pollOnce = useCallback(async () => {
    try {
      const data = await getDiscoverySession(id, actor);
      setSession(prev => {
        if (prev?.status === data.status && prev?.messages.length === data.messages.length) return prev;
        return data;
      });
      if (!AI_PROCESSING_STATUSES.has(data.status)) stopPolling();
    } catch {
      // ignore transient poll errors
    }
  }, [id, actor, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => { void pollOnce(); }, 3000);
  }, [pollOnce, stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => { void load(); }, [load]);

  // Auto-poll if session is already in an AI-processing state when page loads
  useEffect(() => {
    if (session && AI_PROCESSING_STATUSES.has(session.status)) startPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const withBusy = async (fn: () => Promise<DiscoverySession>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      setSession(updated);
      // If AI is still processing, start polling so updates appear automatically
      if (AI_PROCESSING_STATUSES.has(updated.status)) startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    await withBusy(async () => {
      const updated = await sendMessage(id, text, actor);
      if (updated.status === "problem_framed" && updated.solutionOptions.length === 0) {
        return generateSolutions(id, actor);
      }
      return updated;
    });
    // Always start polling after a message — the AI response may arrive async
    startPolling();
  };

  const handleAnswerClarification = async (questionId: string, answer: string) => {
    await withBusy(() => answerClarification(id, questionId, answer, actor));
  };

  const handleSelectDirection = async (solutionId: string) => {
    await withBusy(() => selectDirection(id, solutionId, actor));
  };

  const handleGenerateProposal = async () => {
    await withBusy(() => generateProposal(id, actor));
  };

  const handleGenerateManifest = async () => {
    await withBusy(() => generateManifest(id, actor));
  };

  const handleSendToEvaluation = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await sendToEvaluation(id, actor);
      setSession(result.session);
      // Navigate to the created intake if one was returned
      if (result.intakeRecord && typeof result.intakeRecord === "object") {
        const record = result.intakeRecord as { id?: string };
        if (record.id) {
          try {
            localStorage.setItem(`pit:discovery:intake:${id}`, record.id);
          } catch {}
          router.push(`/intakes/${record.id}`);
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send to evaluation.");
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-brand-muted text-sm">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <Link href="/discovery" className="btn-secondary mt-4 inline-flex">
          ← Back to Discovery
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/discovery"
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            ← Discovery
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-xs text-gray-500">{id.slice(0, 14)}…</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading || busy}
            className="btn-secondary py-1.5 text-xs"
          >
            Refresh
          </button>
          {session.status === "sent_to_evaluation" && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
              Sent to Evaluation
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 px-6 py-2">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Intake handoff callout */}
      {session.status === "sent_to_evaluation" && (
        <div className="shrink-0 mx-6 mt-3 mb-1 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <span className="text-emerald-600 font-medium">
            ✓ Sent to evaluation
          </span>
          <span className="text-emerald-700/60">—</span>
          {linkedIntakeId ? (
            <Link
              href={`/intakes/${linkedIntakeId}`}
              className="text-emerald-700 font-medium hover:text-emerald-900 hover:underline"
            >
              View intake →
            </Link>
          ) : (
            <Link
              href="/intakes"
              className="text-emerald-700 font-medium hover:text-emerald-900 hover:underline"
            >
              View in intakes list →
            </Link>
          )}
        </div>
      )}

      {/* Three-panel layout — fills remaining height */}
      <div className="flex-1 min-h-0">
        <DiscoveryLayout
          left={
            <DiscoveryTimeline
              currentStatus={session.status}
              timeline={session.timeline}
            />
          }
          center={
            <DiscoveryChat
              messages={session.messages}
              clarificationQuestions={session.clarificationQuestions}
              busy={busy}
              onSendMessage={handleSendMessage}
              onAnswerClarification={handleAnswerClarification}
            />
          }
          right={
            <DiscoveryUnderstanding
              status={session.status}
              intent={session.intent}
              problemFrame={session.problemFrame}
              confidence={session.confidence}
              solutionOptions={session.solutionOptions}
              selectedSolutionId={session.selectedSolutionId}
              proposal={session.proposal}
              manifest={session.manifest}
              busy={busy}
              onSelectDirection={handleSelectDirection}
              onGenerateProposal={handleGenerateProposal}
              onGenerateManifest={handleGenerateManifest}
              onSendToEvaluation={handleSendToEvaluation}
            />
          }
        />
      </div>
    </div>
  );
}

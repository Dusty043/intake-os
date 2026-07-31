"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { DiscoveryLayout } from "@/components/discovery/DiscoveryLayout";
import { DiscoveryTimeline } from "@/components/discovery/DiscoveryTimeline";
import { DiscoveryChat } from "@/components/discovery/DiscoveryChat";
import { DiscoveryUnderstanding } from "@/components/discovery/DiscoveryUnderstanding";
import { PhaseZeroPacketPanel } from "@/components/discovery/PhaseZeroPacketPanel";
import {
  answerClarification,
  downloadPhaseZero,
  generatePhaseZero,
  generateSolutions,
  getDiscoverySession,
  selectDirection,
  sendMessage,
  skipClarifications,
  streamDiscoverySession,
} from "@/lib/discovery-client";
import type { DiscoveryStreamEvent } from "@/lib/discovery-client";
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

const PACKET_PROCESSING_STATES = new Set(["queued", "generating", "repairing"]);

function isProcessing(session: DiscoverySession): boolean {
  return AI_PROCESSING_STATUSES.has(session.status)
    || PACKET_PROCESSING_STATES.has(session.phaseZeroPacket?.state ?? "");
}

function overallConfidence(session: DiscoverySession): number {
  const values = Object.values(session.confidence) as number[];
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function DiscoverySessionPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useActor();

  const [session, setSession] = useState<DiscoverySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeStages, setActiveStages] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"discovery" | "packet">("discovery");
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
        if (
          prev?.status === data.status
          && prev?.messages?.length === data.messages?.length
          && prev?.phaseZeroPacket?.state === data.phaseZeroPacket?.state
          && prev?.phaseZeroPacket?.documents.length === data.phaseZeroPacket?.documents.length
        ) return prev;
        return data;
      });
      if (!isProcessing(data)) stopPolling();
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
    if (session && isProcessing(session)) startPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.phaseZeroPacket?.state]);

  useEffect(() => {
    if (session?.phaseZeroPacket) setView("packet");
  }, [session?.phaseZeroPacket?.state]);

  // Live progress stream — one connection per session view, persists across
  // turns. Failure (network error, connection drop) just leaves activeStages
  // empty; the UI falls back to the existing static busy indicator.
  useEffect(() => {
    const controller = new AbortController();
    streamDiscoverySession(
      id,
      actor,
      (event: DiscoveryStreamEvent) => {
        setActiveStages((prev) => {
          const next = new Set(prev);
          if (event.type === "stage-start") next.add(event.stage);
          else if (event.type === "stage-end" || event.type === "error") next.delete(event.stage);
          return next;
        });
      },
      controller.signal,
    ).catch(() => {
      // Connection failed, was aborted, or the server closed it — fine, the
      // static indicator covers this.
    });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, actor.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const withBusy = async (fn: () => Promise<DiscoverySession>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      setSession(updated);
      // If AI is still processing, start polling so updates appear automatically
      if (isProcessing(updated)) startPolling();
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
    startPolling();
  };

  const handleSkipClarifications = async () => {
    await withBusy(() => skipClarifications(id, actor));
    startPolling();
  };

  const handleSelectDirection = async (solutionId: string) => {
    await withBusy(() => selectDirection(id, solutionId, actor));
    startPolling();
  };

  const handleGeneratePhaseZero = async () => {
    await withBusy(() => generatePhaseZero(id, actor));
    setView("packet");
    startPolling();
  };

  const handleDownloadPhaseZero = async () => {
    setError(null);
    try {
      const blob = await downloadPhaseZero(id, actor);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `phase-zero-${id}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download the Phase 0 packet.");
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
          <div className="flex rounded-lg border border-gray-200 p-0.5" aria-label="Workspace view">
            <button
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === "discovery" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              onClick={() => setView("discovery")}
            >
              Discovery
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === "packet" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              onClick={() => setView("packet")}
            >
              Phase 0 Packet
            </button>
          </div>
          <button
            onClick={load}
            disabled={loading || busy}
            className="btn-secondary py-1.5 text-xs"
          >
            Refresh
          </button>
          {session.phaseZeroPacket && (
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded">
              {session.phaseZeroPacket.state.replaceAll("_", " ")}
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

      <div className="flex-1 min-h-0">
        {view === "packet" ? (
          <PhaseZeroPacketPanel
            packet={session.phaseZeroPacket}
            confidence={overallConfidence(session)}
            directionSelected={Boolean(session.selectedSolutionId)}
            busy={busy}
            onGenerate={handleGeneratePhaseZero}
            onDownload={handleDownloadPhaseZero}
          />
        ) : <DiscoveryLayout
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
              confidence={session.confidence}
              proposal={session.proposal}
              busy={busy}
              activeStages={activeStages}
              onSendMessage={handleSendMessage}
              onAnswerClarification={handleAnswerClarification}
              onSkipClarifications={handleSkipClarifications}
            />
          }
          right={
            <DiscoveryUnderstanding
              intent={session.intent}
              problemFrame={session.problemFrame}
              confidence={session.confidence}
              solutionOptions={session.solutionOptions}
              selectedSolutionId={session.selectedSolutionId}
              busy={busy}
              onSelectDirection={handleSelectDirection}
            />
          }
        />}
      </div>
    </div>
  );
}

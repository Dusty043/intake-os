"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ClarificationQuestion,
  DiscoveryConfidence,
  DiscoveryManifest,
  DiscoveryMessage,
  DiscoveryProposal,
  DiscoveryStatus,
} from "@/lib/discovery-types";

function overallConfidence(c: DiscoveryConfidence): number {
  const vals = Object.values(c) as number[];
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Friendly labels for DiscoveryAgentRole stage names streamed from the backend.
const STAGE_LABELS: Record<string, string> = {
  intent_extraction: "Understanding your request",
  problem_framing: "Framing the problem",
  solution_generation: "Generating solution options",
  clarification: "Planning clarifying questions",
  proposal_composition: "Composing the proposal",
  manifest_generation: "Generating the manifest",
};

// Live stage labels when we have them; falls back to a generic message when
// the stream hasn't reported anything yet (or failed) but a request is busy.
function progressText(activeStages: Set<string>): string {
  const labels = Array.from(activeStages, (stage) => STAGE_LABELS[stage] ?? "Working");
  return labels.length > 0 ? `${labels.join(" · ")}…` : "AI is thinking…";
}

type ClarificationCardProps = {
  question: ClarificationQuestion;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
  disabled: boolean;
};

function ClarificationCard({ question, onAnswer, disabled }: ClarificationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const impactColors: Record<string, string> = {
    blocking: "bg-red-100 text-red-700 border-red-200",
    important: "bg-amber-100 text-amber-700 border-amber-200",
    deferred: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAnswer(question.id, answer.trim());
      setExpanded(false);
      setAnswer("");
    } catch {
      // errors are handled upstream by withBusy; don't propagate as unhandled rejection
    } finally {
      setSubmitting(false);
    }
  };

  if (question.answered) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg px-3 py-2">
        <p className="text-xs font-medium text-green-700 mb-0.5">Answered</p>
        <p className="text-sm text-gray-700">{question.question}</p>
        <p className="text-sm text-green-700 mt-1 italic">{question.answer}</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        disabled={disabled}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed"
      >
        <span
          className={`mt-0.5 shrink-0 text-xs font-medium px-1.5 py-0.5 rounded border ${
            impactColors[question.impact] ?? impactColors.deferred
          }`}
        >
          {question.impact}
        </span>
        <span className="flex-1 text-sm text-gray-800">{question.question}</span>
        <span className="shrink-0 text-gray-400 text-xs mt-0.5">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-white">
          <label htmlFor={`clarification-answer-${question.id}`} className="sr-only">
            Answer for: {question.question}
          </label>
          <textarea
            id={`clarification-answer-${question.id}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            className="form-textarea mt-2 text-sm"
            disabled={submitting || disabled}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setExpanded(false)}
              className="btn-secondary py-1.5 text-xs"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting || disabled}
              className="btn-primary py-1.5 text-xs"
            >
              {submitting ? "Submitting…" : "Submit Answer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Clarification drawer (collapsed by default — see DiscoveryChat) ─────────

type ClarificationDrawerProps = {
  pendingQuestions: ClarificationQuestion[];
  answeredQuestions: ClarificationQuestion[];
  canProceed: boolean;
  busy: boolean;
  sending: boolean;
  onAnswerClarification: (questionId: string, answer: string) => Promise<void>;
  onSkipClarifications: () => Promise<void>;
};

function ClarificationDrawer({
  pendingQuestions,
  answeredQuestions,
  canProceed,
  busy,
  sending,
  onAnswerClarification,
  onSkipClarifications,
}: ClarificationDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const hasBlocking = pendingQuestions.some((q) => q.impact === "blocking");

  return (
    <div className="border-t border-gray-100 bg-gray-50 shrink-0">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasBlocking ? "bg-red-500" : "bg-amber-500"}`} />
          {pendingQuestions.length > 0
            ? `${pendingQuestions.length} question${pendingQuestions.length !== 1 ? "s" : ""} to clarify`
            : "All clarifications answered"}
          <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </button>

        {canProceed && (
          <button
            onClick={onSkipClarifications}
            disabled={busy || sending}
            className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Proceed with assumptions →
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 max-h-56 overflow-y-auto">
          {pendingQuestions.map((q) => (
            <ClarificationCard
              key={q.id}
              question={q}
              onAnswer={onAnswerClarification}
              disabled={busy || sending}
            />
          ))}
          {answeredQuestions.map((q) => (
            <ClarificationCard
              key={q.id}
              question={q}
              onAnswer={onAnswerClarification}
              disabled={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Proposal / manifest cards (auto-generated, shown inline in the conversation) ──

function ProposalCard({ proposal }: { proposal: DiscoveryProposal }) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] border border-gray-200 rounded-2xl rounded-tl-sm bg-white p-4 space-y-2.5">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Proposal</p>
        <p className="text-sm font-semibold text-gray-900">{proposal.title}</p>

        {proposal.suggestedEpics.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Suggested Epics</p>
            <ul className="text-sm text-gray-700 space-y-1">
              {proposal.suggestedEpics.map((e, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-indigo-400 shrink-0">▸</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {proposal.unknowns.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Open Unknowns</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {proposal.unknowns.map((u, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-amber-400 shrink-0">?</span>
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

type ManifestCardProps = {
  manifest: DiscoveryManifest;
  discoveryStatus: DiscoveryStatus;
  busy: boolean;
  onSendToEvaluation: () => Promise<void>;
};

function ManifestCard({ manifest, discoveryStatus, busy, onSendToEvaluation }: ManifestCardProps) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] border border-gray-200 rounded-2xl rounded-tl-sm bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Manifest</p>
          <span className="text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
            {manifest.recommendedAction.replace(/_/g, " ")}
          </span>
        </div>

        {(manifest.monday.roadmapEpics.length > 0 || manifest.monday.projectsPortfolio) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Monday</p>
            {manifest.monday.projectsPortfolio && (
              <div className="space-y-0.5 mb-1 text-sm">
                <p className="text-gray-700">
                  <span className="font-medium">Project:</span> {manifest.monday.projectsPortfolio.name}
                  <span className="text-gray-400 ml-1">
                    ({manifest.monday.projectsPortfolio.projectType})
                  </span>
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Status:</span> {manifest.monday.projectsPortfolio.status}
                </p>
              </div>
            )}
            {manifest.monday.roadmapEpics.length > 0 && (
              <div className="space-y-0.5">
                {manifest.monday.roadmapEpics.map((epic, i) => (
                  <div key={i} className="flex items-center justify-between text-sm text-gray-600">
                    <span className="flex gap-1.5 min-w-0">
                      <span className="text-indigo-400 shrink-0">▸</span>
                      <span className="truncate">{epic.title}</span>
                    </span>
                    {epic.estimatedSP && (
                      <span className="shrink-0 ml-1 text-gray-400 text-xs">{epic.estimatedSP} SP</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {manifest.monday.sprintTasks.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                + {manifest.monday.sprintTasks.length} task{manifest.monday.sprintTasks.length !== 1 ? "s" : ""} → Backlog
              </p>
            )}
          </div>
        )}

        {manifest.github.createRepo && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">GitHub</p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Repo:</span> <span className="font-mono">{manifest.github.repoName}</span>
            </p>
            {manifest.github.readme && (
              <p className="text-xs text-gray-500 mt-0.5">
                README · {manifest.github.labels.length} labels · {manifest.github.initialIssues.length} issues
              </p>
            )}
          </div>
        )}

        {!manifest.readyForLiveAdapter && (
          <p className="text-xs text-amber-600">Mock manifest — live adapter not yet connected</p>
        )}

        <button
          onClick={onSendToEvaluation}
          disabled={busy || discoveryStatus === "sent_to_evaluation"}
          className="btn-primary w-full justify-center mt-1"
        >
          {discoveryStatus === "sent_to_evaluation" ? "Sent to Evaluation" : "Send to Evaluation"}
        </button>
      </div>
    </div>
  );
}

type Props = {
  messages: DiscoveryMessage[];
  clarificationQuestions: ClarificationQuestion[];
  confidence: DiscoveryConfidence;
  proposal: DiscoveryProposal | null;
  manifest: DiscoveryManifest | null;
  discoveryStatus: DiscoveryStatus;
  busy: boolean;
  activeStages: Set<string>;
  onSendMessage: (text: string) => Promise<void>;
  onAnswerClarification: (questionId: string, answer: string) => Promise<void>;
  onSkipClarifications: () => Promise<void>;
  onSendToEvaluation: () => Promise<void>;
};

export function DiscoveryChat({
  messages,
  clarificationQuestions,
  confidence,
  proposal,
  manifest,
  discoveryStatus,
  busy,
  activeStages,
  onSendMessage,
  onAnswerClarification,
  onSkipClarifications,
  onSendToEvaluation,
}: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || busy) return;
    setInput("");
    setSending(true);
    try {
      await onSendMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const pendingQuestions = clarificationQuestions.filter((q) => !q.answered);
  const answeredQuestions = clarificationQuestions.filter((q) => q.answered);
  const canProceed = pendingQuestions.length > 0 && overallConfidence(confidence) >= 0.5;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="section-label mb-0">Conversation</p>
        <span aria-live="polite" className="text-xs text-indigo-600 font-medium flex items-center gap-1.5 min-h-[1rem]">
          {busy && (
            <>
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              {progressText(activeStages)}
            </>
          )}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-brand-muted text-sm py-8">
            Send a message to begin the discovery conversation.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-gray-100 text-gray-800 rounded-tl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.role === "user" ? "text-indigo-200" : "text-gray-400"
                }`}
              >
                {formatTime(msg.createdAt)}
              </p>
            </div>
          </div>
        ))}

        {proposal && <ProposalCard proposal={proposal} />}
        {manifest && (
          <ManifestCard
            manifest={manifest}
            discoveryStatus={discoveryStatus}
            busy={busy}
            onSendToEvaluation={onSendToEvaluation}
          />
        )}

        {/* Typing indicator */}
        {(sending || busy) && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing-dot [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing-dot [animation-delay:200ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing-dot [animation-delay:400ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Clarification questions — collapsed by default, doesn't dominate the chat */}
      {clarificationQuestions.length > 0 && (
        <ClarificationDrawer
          pendingQuestions={pendingQuestions}
          answeredQuestions={answeredQuestions}
          canProceed={canProceed}
          busy={busy}
          sending={sending}
          onAnswerClarification={onAnswerClarification}
          onSkipClarifications={onSkipClarifications}
        />
      )}

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white">
        <div className="flex gap-2 items-end">
          <label htmlFor="discovery-message-input" className="sr-only">
            Message
          </label>
          <textarea
            id="discovery-message-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project or idea… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="form-textarea flex-1 text-sm resize-none"
            disabled={sending || busy}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || busy}
            className="btn-primary py-2.5 self-end"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

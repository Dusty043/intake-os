"use client";

import { useEffect, useRef, useState } from "react";
import type { ClarificationQuestion, DiscoveryMessage } from "@/lib/discovery-types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
          <textarea
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

type Props = {
  messages: DiscoveryMessage[];
  clarificationQuestions: ClarificationQuestion[];
  busy: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onAnswerClarification: (questionId: string, answer: string) => Promise<void>;
};

export function DiscoveryChat({
  messages,
  clarificationQuestions,
  busy,
  onSendMessage,
  onAnswerClarification,
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="section-label mb-0">Conversation</p>
        {busy && (
          <span className="text-xs text-indigo-600 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            AI is thinking…
          </span>
        )}
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

      {/* Clarification questions */}
      {clarificationQuestions.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
          <p className="section-label mb-1">Clarification Questions</p>
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

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
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

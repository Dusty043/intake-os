"use client";

import React from "react";
import type { PendingClarificationQuestion } from "@/lib/types";

type PriorClarification = { question: string; answer: string };

function QuestionField({
  q,
  value,
  isError,
  required,
  onChange,
  onBlur,
}: {
  q: PendingClarificationQuestion;
  value: string;
  isError: boolean;
  required: boolean;
  onChange: (val: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label htmlFor={`q-${q.id}`} className="block text-xs font-medium text-brand-text mb-1">
        {q.question}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {q.reason && <p className="text-xs text-brand-muted mb-1">{q.reason}</p>}
      <textarea
        id={`q-${q.id}`}
        aria-required={required || undefined}
        aria-invalid={isError || undefined}
        aria-describedby={isError ? `err-${q.id}` : undefined}
        className={`w-full border rounded-md px-2 py-1.5 text-sm text-brand-text resize-none focus:outline-none focus:ring-1 ${
          isError ? "border-red-400 focus:ring-red-400" : "border-gray-200 focus:ring-brand-accent"
        }`}
        rows={2}
        placeholder={required ? "Your answer…" : "Your answer… (optional)"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {isError && (
        <p id={`err-${q.id}`} className="text-xs text-red-600 mt-0.5">This answer is required.</p>
      )}
    </div>
  );
}

export function ClarificationPanel({
  questions,
  missingFields,
  priorClarifications,
  busy,
  onResubmit,
}: {
  questions: PendingClarificationQuestion[];
  missingFields: string[];
  priorClarifications?: PriorClarification[];
  busy: boolean;
  onResubmit: (answers: PriorClarification[]) => Promise<void>;
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [resubmitError, setResubmitError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const submittingRef = React.useRef(false);

  React.useEffect(() => {
    setAnswers({});
    setTouched({});
    setResubmitError(null);
    setSubmitted(false);
    submittingRef.current = false;
  }, [questions]);

  const required = questions.filter((q) => q.required);
  const optional = questions.filter((q) => !q.required);
  const canSubmit = required.every((q) => !!answers[q.id]?.trim());

  async function handleResubmit() {
    if (submittingRef.current) return;
    const newTouched: Record<string, boolean> = {};
    for (const q of required) newTouched[q.id] = true;
    setTouched((prev) => ({ ...prev, ...newTouched }));
    if (!canSubmit) return;
    submittingRef.current = true;
    setResubmitError(null);
    const filled = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ question: q.question, answer: answers[q.id].trim() }));
    try {
      await onResubmit(filled);
      setSubmitted(true);
    } catch (e) {
      setResubmitError(e instanceof Error ? e.message : "Resubmission failed.");
    } finally {
      submittingRef.current = false;
    }
  }

  if (submitted) {
    return (
      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <p className="font-semibold">Resubmitted successfully.</p>
        <p>Your intake is being re-evaluated. The status will update shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
        <p className="font-semibold mb-1">Clarification required</p>
        {missingFields.length > 0 && <p className="mb-1">Missing: {missingFields.join(", ")}.</p>}
        <p>Answer the questions below, then resubmit to continue evaluation.</p>
      </div>

      {priorClarifications && priorClarifications.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 space-y-2">
          <p className="text-xs font-semibold text-gray-600">Previous answers:</p>
          {priorClarifications.map((pc, i) => (
            <div key={pc.question || String(i)}>
              <p className="text-xs text-gray-500 italic">{pc.question}</p>
              <p className="text-xs text-brand-text">↳ {pc.answer}</p>
            </div>
          ))}
        </div>
      )}

      {required.length > 0 && (
        <div className="space-y-3">
          {optional.length > 0 && (
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Required</p>
          )}
          {required.map((q) => (
            <QuestionField
              key={q.id}
              q={q}
              value={answers[q.id] ?? ""}
              isError={!!touched[q.id] && !answers[q.id]?.trim()}
              required
              onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
              onBlur={() => setTouched((prev) => ({ ...prev, [q.id]: true }))}
            />
          ))}
        </div>
      )}

      {optional.length > 0 && (
        <div className="space-y-3">
          {required.length > 0 && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Optional</p>
          )}
          {optional.map((q) => (
            <QuestionField
              key={q.id}
              q={q}
              value={answers[q.id] ?? ""}
              isError={false}
              required={false}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
            />
          ))}
        </div>
      )}

      {resubmitError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resubmitError}</p>
      )}

      <div>
        <button
          className="btn-secondary"
          onClick={() => { void handleResubmit(); }}
          disabled={busy || !canSubmit}
        >
          {busy ? "Resubmitting…" : "Resubmit for Evaluation"}
        </button>
        {!canSubmit && (
          <p className="text-xs text-gray-400 mt-1">Answer all required questions to resubmit.</p>
        )}
      </div>
    </div>
  );
}

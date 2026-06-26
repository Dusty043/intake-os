"use client";

import { useState } from "react";

type Props = {
  onStart: (message: string) => Promise<void>;
};

export function DiscoveryStartForm({ onStart }: Props) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await onStart(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Describe your project or problem
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Our support team answers the same questions every day. It's slow and frustrating. We want to automate some of this."
          rows={5}
          className="form-textarea w-full text-sm"
          disabled={submitting}
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-1">
          Don&apos;t worry about being precise — the AI will help you refine the problem.
        </p>
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={!message.trim() || submitting}
          className="btn-primary"
        >
          {submitting ? "Starting…" : "Start Discovery"}
        </button>
      </div>
    </form>
  );
}

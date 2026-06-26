"use client";

import { useRef, useState } from "react";

type Props = {
  onStart: (message: string) => Promise<void>;
  onClose: () => void;
};

export function DiscoveryStartModal({ onStart, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onStart(text);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to start discovery.");
      setBusy(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="card w-full max-w-lg mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-text">Start Discovery</h2>
            <p className="text-sm text-brand-muted mt-0.5">
              Describe your project idea or problem. The AI will guide you through discovery.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {err && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label" htmlFor="initial-message">
              What are you trying to build or solve?
            </label>
            <textarea
              id="initial-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. We need a way for field technicians to log equipment faults without internet access…"
              rows={5}
              className="form-textarea text-sm"
              disabled={busy}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Don't worry about structure — just describe it naturally.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim() || busy}
              className="btn-primary"
            >
              {busy ? "Starting…" : "Start Discovery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

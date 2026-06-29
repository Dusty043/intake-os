import { useEffect } from "react";

type Props = { message: string | null; onDismiss: () => void };

export function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm"
    >
      <span className="shrink-0 font-bold">✓</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 text-emerald-500 hover:text-emerald-700 font-bold"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

type Props = { error: string | null; onDismiss?: () => void };

export function ErrorBanner({ error, onDismiss }: Props) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm"
    >
      <span className="shrink-0 font-bold">Error:</span>
      <span className="flex-1">{error}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-red-500 hover:text-red-700 font-bold"
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getDiscoverySettings, updateDiscoverySettings } from "@/lib/api-client";
import type { DiscoverySettings } from "@/lib/api-client";

export default function SettingsPage() {
  const { actor } = useActor();
  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [draft, setDraft] = useState<DiscoverySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDiscoverySettings(actor);
      setSettings(data);
      setDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateDiscoverySettings(actor, draft);
      setSettings(updated);
      setDraft(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = draft && settings && draft.confidenceThreshold !== settings.confidenceThreshold;

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-text">Settings</h1>
        <p className="text-sm text-brand-muted mt-0.5">
          Global configuration for the intake system.
        </p>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="card p-12 text-center text-brand-muted text-sm">Loading…</div>
      ) : draft ? (
        <section className="card p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-brand-text mb-1">Discovery Engine</h2>
            <p className="text-sm text-brand-muted">
              Controls how the AI-powered discovery conversation behaves.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-brand-text" htmlFor="confidence-threshold">
                Confidence Threshold
              </label>
              <span className="font-mono text-sm font-semibold text-indigo-600">
                {Math.round(draft.confidenceThreshold * 100)}%
              </span>
            </div>
            <input
              id="confidence-threshold"
              type="range"
              min={10}
              max={90}
              step={5}
              value={Math.round(draft.confidenceThreshold * 100)}
              onChange={(e) =>
                setDraft({ ...draft, confidenceThreshold: Number(e.target.value) / 100 })
              }
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-brand-muted">
              <span>10% — proceed quickly with many assumptions</span>
              <span>90% — require near-complete information</span>
            </div>
            <p className="text-xs text-brand-muted pt-1">
              When a session&apos;s average confidence score exceeds this threshold, the discovery
              engine advances to solution generation instead of asking more clarifying questions.
              Lower values mean fewer questions and more assumptions; higher values produce more
              thorough intake scoping.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-brand-border">
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="btn-primary"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {isDirty && (
              <button
                onClick={() => setDraft(settings)}
                disabled={saving}
                className="btn-secondary"
              >
                Discard
              </button>
            )}
            {saved && (
              <span className="text-sm text-emerald-600 font-medium">Saved.</span>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

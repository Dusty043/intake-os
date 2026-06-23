"use client";

import { useState } from "react";
import type { AssignmentOverride, AssignmentRecommendation, UiActor } from "@/lib/types";
import { clearAssignmentOverride, overrideAssignment } from "@/lib/api-client";
import type { ProjectIntakeRecord } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";

function ConfidencePip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 shrink-0">{pct}%</span>
    </div>
  );
}

interface Props {
  intake: ProjectIntakeRecord;
  actor: UiActor;
  onUpdate: (updated: ProjectIntakeRecord) => void;
  canOverride: boolean;
}

export function AssignmentCard({ intake, actor, onUpdate, canOverride }: Props) {
  const rec = intake.latestAnalysisDraft?.assignmentRecommendation as AssignmentRecommendation | undefined;
  const override = intake.assignmentOverride as AssignmentOverride | undefined;

  const [showForm, setShowForm] = useState(false);
  const [devName, setDevName] = useState("");
  const [devId, setDevId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleOverride() {
    if (!devName.trim() || !reason.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await overrideAssignment(intake.id, actor, devName.trim(), reason.trim(), devId.trim() || undefined);
      onUpdate(updated);
      setShowForm(false);
      setDevName(""); setDevId(""); setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    setErr(null);
    try {
      const updated = await clearAssignmentOverride(intake.id, actor);
      onUpdate(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const effective = override
    ? { name: override.developerName, id: override.developerId, isOverride: true }
    : rec?.displayName
    ? { name: rec.displayName, id: rec.developerId, isOverride: false }
    : null;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand-text">Developer Assignment</h3>
        {effective?.isOverride && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Manual Override</span>
        )}
        {!effective?.isOverride && rec?.rosterConnected && (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Roster Match</span>
        )}
        {!effective?.isOverride && !rec?.rosterConnected && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Advisory</span>
        )}
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {/* Effective assignment */}
      {effective ? (
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-indigo-700">
              {effective.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-text">{effective.name}</p>
            {effective.id && <p className="text-xs text-brand-muted font-mono">{effective.id}</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-brand-muted">No recommendation yet.</p>
      )}

      {/* AI recommendation details (when not overridden) */}
      {!override && rec && (
        <div className="space-y-2 text-sm">
          {rec.confidence != null && (
            <div>
              <p className="section-label mb-1">Confidence</p>
              <ConfidencePip value={rec.confidence} />
            </div>
          )}
          <div>
            <p className="section-label">Rationale</p>
            <p className="text-brand-muted text-xs mt-0.5">{rec.reason}</p>
          </div>
          {rec.matchedSkills.length > 0 && (
            <div>
              <p className="section-label">Matched Skills</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {rec.matchedSkills.map((s, i) => (
                  <span key={i} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          {rec.backupDisplayName && (
            <div>
              <p className="section-label">Backup</p>
              <p className="text-xs text-brand-muted">{rec.backupDisplayName}</p>
            </div>
          )}
          {rec.workloadSignals.length > 0 && (
            <div>
              <p className="section-label">Workload Signals</p>
              <ul className="space-y-0.5 mt-0.5">
                {rec.workloadSignals.map((s, i) => (
                  <li key={i} className="text-xs text-gray-500">• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {rec.risks.length > 0 && (
            <div>
              <p className="section-label text-amber-600">Risks</p>
              <ul className="space-y-0.5 mt-0.5">
                {rec.risks.map((r, i) => (
                  <li key={i} className="text-xs text-amber-700">• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Override details if active */}
      {override && (
        <div className="text-xs text-brand-muted space-y-0.5 border-t border-gray-100 pt-2">
          <p><span className="font-medium">Reason:</span> {override.reason}</p>
          <p><span className="font-medium">Set by:</span> {override.overriddenBy?.displayName ?? override.overriddenBy?.id}</p>
        </div>
      )}

      {/* Override controls */}
      {canOverride && !showForm && (
        <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
          <button
            className="btn-secondary text-xs"
            onClick={() => setShowForm(true)}
            disabled={busy}
          >
            {override ? "Change Override" : "Override Assignment"}
          </button>
          {override && (
            <button
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              onClick={() => { void handleClear(); }}
              disabled={busy}
            >
              {busy ? "Clearing…" : "Clear Override"}
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-brand-text">Assign Developer</p>
          <input
            type="text"
            placeholder="Developer name *"
            value={devName}
            onChange={(e) => setDevName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            type="text"
            placeholder="Developer ID (optional)"
            value={devId}
            onChange={(e) => setDevId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <textarea
            placeholder="Reason for override *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
          <div className="flex gap-2">
            <button
              className="btn-primary text-xs"
              onClick={() => { void handleOverride(); }}
              disabled={busy || !devName.trim() || !reason.trim()}
            >
              {busy ? "Saving…" : "Save Override"}
            </button>
            <button className="btn-secondary text-xs" onClick={() => setShowForm(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

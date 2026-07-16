"use client";

import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { KV } from "@/components/KV";
import {
  executeDistribution,
  generateProvisioningPlan,
  listProvisioningRuns,
  markReadyForProvisioning,
  retryProvisioningRun,
} from "@/lib/api-client";
import { formatDate } from "@/lib/formatting";
import type { ProjectIntakeRecord, ProvisioningRun, UiActor } from "@/lib/types";

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "danger" | "info" | "warning" | "reviewed" }> = {
    executing:       { label: "Executing…", variant: "info" },
    completed:       { label: "Completed",  variant: "success" },
    failed:          { label: "Failed",     variant: "danger" },
    partial_success: { label: "Partial",    variant: "warning" },
    succeeded:       { label: "Succeeded",  variant: "success" },
    skipped:         { label: "Skipped",    variant: "info" },
    pending:         { label: "Pending",    variant: "info" },
    pending_retry:   { label: "Retrying…",  variant: "warning" },
  };
  const s = map[status] ?? { label: status, variant: "info" as const };
  return <StatusBadge label={s.label} variant={s.variant} />;
}

function ProvisioningRunPanel({
  run,
  canRetry,
  onRetry,
  retrying,
}: {
  run: ProvisioningRun;
  canRetry?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const hasRetryableFailures = run.targets.some((t) => t.status === "failed" && t.retryable);
  const showRetryBtn = canRetry && hasRetryableFailures && (run.status === "failed" || run.status === "partial_success");

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">{run.id}</span>
            {run.kind === "retry" && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Retry</span>
            )}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            Triggered by {run.triggeredByName ?? run.triggeredById} ({run.triggeredByRole})
            {run.startedAt && <> at {formatDate(run.startedAt)}</>}
          </p>
        </div>
        <RunStatusBadge status={run.status} />
      </div>

      {run.targets.length > 0 && (
        <div className="space-y-2 pt-1">
          {run.targets.map((t) => (
            <div key={t.id} className="flex items-start gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <RunStatusBadge status={t.status} />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs font-medium text-brand-text">
                  {t.targetKind.replace(/_/g, " ")}
                </span>
                {t.externalUrl && (
                  <a
                    href={t.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-indigo-600 hover:underline truncate"
                  >
                    {t.externalId ?? t.externalUrl}
                  </a>
                )}
                {t.errorMessage && (
                  <p className="text-xs text-red-600 mt-0.5">{t.errorMessage}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showRetryBtn && onRetry && (
        <div className="border-t border-gray-100 pt-3 flex items-center gap-3">
          <button
            className="btn-secondary text-sm"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? "Retrying…" : "Retry Failed Targets"}
          </button>
          <span className="text-xs text-brand-muted">
            Only failed targets will be re-attempted.
          </span>
        </div>
      )}
    </div>
  );
}

export function DistributionTab({
  intake,
  actor,
  onIntakeUpdate,
  onSuccess,
}: {
  intake: ProjectIntakeRecord;
  actor: UiActor;
  onIntakeUpdate: (updated: ProjectIntakeRecord) => void;
  onSuccess: (message: string) => void;
}) {
  const plan = intake.provisioningPlan;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [teamPrefix, setTeamPrefix] = useState(""); // ponytail: no org-config source for a default prefix exists yet; require explicit entry instead of hardcoding one org's abbreviation
  const [runs, setRuns] = useState<ProvisioningRun[] | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  const status = intake.status;
  const gate2Done = ["approved", "provisioning", "distributed", "provisioning_failed"].includes(status);
  const planReady = plan?.status === "ready_for_provisioning";
  const canExecute = planReady && status === "approved";
  const isExecuting = status === "provisioning";
  const isDistributed = status === "distributed";
  const canRetryRun = status === "provisioning_failed";

  async function doGenPlan() {
    setBusy("gen_plan"); setErr(null);
    try {
      const updated = await generateProvisioningPlan(intake.id, actor, teamPrefix);
      onIntakeUpdate(updated);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function doMarkReady() {
    setBusy("mark_ready"); setErr(null);
    try {
      const updated = await markReadyForProvisioning(intake.id, actor);
      onIntakeUpdate(updated);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function doExecute() {
    setBusy("execute"); setErr(null);
    try {
      const run = await executeDistribution(intake.id, actor);
      setRuns((prev) => [run, ...(prev ?? [])]);
      const updated = await import("@/lib/api-client").then(m => m.getIntake(intake.id, actor));
      onIntakeUpdate(updated);
      onSuccess("Distribution executing. Track progress below.");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function doRetry(runId: string) {
    setRetryingRunId(runId); setErr(null);
    try {
      const retryRun = await retryProvisioningRun(intake.id, runId, actor);
      setRuns((prev) => [retryRun, ...(prev ?? [])]);
      const updated = await import("@/lib/api-client").then(m => m.getIntake(intake.id, actor));
      onIntakeUpdate(updated);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setRetryingRunId(null); }
  }

  async function loadRuns() {
    setRunsLoading(true);
    try {
      const data = await listProvisioningRuns(intake.id, actor);
      setRuns(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load provisioning runs.");
    } finally { setRunsLoading(false); }
  }

  useEffect(() => { void loadRuns(); }, [intake.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Q-FAR-3: a run can come back "executing" with a target still "pending_retry" — the
  // backend keeps auto-retrying in the background rather than blocking the original request.
  // Poll until it settles so this view doesn't go stale while that happens.
  //
  // `actor` is included below (unlike the effect above) because polling must use the
  // currently-selected persona's headers. ACTORS entries are stable references from a
  // static array (see ActorSelector/ACTORS in lib/actors.ts) and setActor always assigns
  // one of those, so `actor` only changes identity when the user actually switches persona
  // — not on every render — so this cannot spin into an infinite loop.
  const hasExecutingRun = runs?.some((r) => r.status === "executing") ?? false;
  useEffect(() => {
    if (!hasExecutingRun) return;
    const interval = setInterval(() => {
      void loadRuns();
      void import("@/lib/api-client")
        .then((m) => m.getIntake(intake.id, actor))
        .then(onIntakeUpdate)
        .catch((e) => {
          setErr(e instanceof Error ? e.message : "Failed to refresh distribution status.");
        });
    }, 2000);
    return () => clearInterval(interval);
  }, [hasExecutingRun, intake.id, actor]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {isDistributed ? (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          <strong>Distribution complete.</strong> All targets provisioned successfully.
        </div>
      ) : isExecuting ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          <strong>Provisioning in progress…</strong> External systems are being updated.
        </div>
      ) : status === "provisioning_failed" ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          <strong>Provisioning failed.</strong> One or more targets did not succeed. Review run history below.
        </div>
      ) : planReady ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          <strong>Ready for execution.</strong> This plan has been approved for distribution. Execution will write to external systems.
        </div>
      ) : (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-4 py-3 text-sm">
          <strong>Dry-run preview only.</strong> No external systems have been modified.
        </div>
      )}

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {/* No plan yet */}
      {!plan && (
        <div className="card p-8 text-center">
          <p className="text-brand-muted mb-4">No distribution preview has been generated yet.</p>
          {!gate2Done && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
              Distribution preview requires Gate 2 approval.
            </p>
          )}
          {gate2Done && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="team-prefix" className="text-xs text-brand-muted font-medium whitespace-nowrap">Team prefix (required)</label>
                <input
                  id="team-prefix"
                  type="text"
                  value={teamPrefix}
                  onChange={(e) => setTeamPrefix(e.target.value.trim())}
                  placeholder="e.g. sb"
                  required
                  className="border border-brand-border rounded px-2 py-1 text-sm w-24 text-center"
                />
              </div>
              <button className="btn-primary" onClick={() => { void doGenPlan(); }} disabled={!!busy || !teamPrefix}>
                {busy === "gen_plan" ? "Generating…" : "Generate Distribution Preview"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Plan exists */}
      {plan && (
        <div className="space-y-4">
          {/* Plan metadata + actions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-brand-text">Distribution Preview</h3>
              <RunStatusBadge status={plan.status ?? "draft"} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
              <KV label="Source" value={
                plan.source?.type === "reviewed_project_package"
                  ? <StatusBadge label="Reviewed Package" variant="reviewed" />
                  : plan.source?.type ?? "—"
              } />
              <KV label="Validation" value={
                <StatusBadge
                  label={plan.validation?.valid ? "Valid" : "Invalid"}
                  variant={plan.validation?.valid ? "success" : "danger"}
                />
              } />
              <KV label="Source ID" value={<span className="font-mono text-xs">{plan.source?.sourceId}</span>} />
              <KV label="Reviewed At" value={formatDate(plan.source?.reviewedAt)} />
            </dl>

            {/* Governance actions */}
            {!planReady && !isDistributed && !isExecuting && status === "approved" && plan.validation?.valid && (actor.role === "devops_lead" || actor.role === "admin") && (
              <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
                <button
                  className="btn-primary"
                  onClick={() => { void doMarkReady(); }}
                  disabled={!!busy}
                >
                  {busy === "mark_ready" ? "Marking ready…" : "Mark Plan Ready"}
                </button>
                <span className="text-xs text-brand-muted">
                  This marks the plan as ready for execution. You will still confirm before writing to external systems.
                </span>
              </div>
            )}

            {canExecute && (
              <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
                <button
                  className="btn-primary bg-green-600 hover:bg-green-700 focus:ring-green-500"
                  onClick={() => { void doExecute(); }}
                  disabled={!!busy}
                >
                  {busy === "execute" ? "Executing…" : "Execute Distribution"}
                </button>
                <span className="text-xs text-brand-muted">
                  This will write to external systems (Monday, GitHub). This action cannot be undone.
                </span>
              </div>
            )}
          </div>

          {/* Dry-run action list */}
          {plan.actions && plan.actions.length > 0 && (
            <div className="card p-5">
              <h3 className="text-base font-semibold text-brand-text mb-3">
                Planned Actions ({plan.actions.length})
              </h3>
              <div className="space-y-2">
                {plan.actions.map((a, i) => (
                  <details key={i} className="bg-gray-50 rounded-lg">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          {a.system ?? a.provider}
                        </span>
                        <span className="font-medium text-brand-text">{a.action ?? a.name}</span>
                        {a.description && <span className="text-brand-muted">{a.description}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <StatusBadge label={planReady ? "Approved" : "Dry Run"} variant={planReady ? "success" : "info"} />
                        <span className="text-gray-400 text-xs">▼</span>
                      </div>
                    </summary>
                    <div className="border-t border-gray-200 px-4 py-3">
                      {a.idempotencyKey && (
                        <p className="text-xs text-gray-500 mb-2 font-mono">Key: {a.idempotencyKey}</p>
                      )}
                      <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-3 overflow-x-auto font-mono">
                        {JSON.stringify(a.payload, null, 2)}
                      </pre>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Run history */}
      {(runs !== null && runs.length > 0) || runsLoading ? (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-brand-text">Execution History</h3>
          {runsLoading && <p className="text-sm text-brand-muted">Loading runs…</p>}
          {runs?.map((run) => (
            <ProvisioningRunPanel
              key={run.id}
              run={run}
              canRetry={canRetryRun}
              onRetry={() => { void doRetry(run.id); }}
              retrying={retryingRunId === run.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

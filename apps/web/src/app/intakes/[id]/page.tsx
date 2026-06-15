"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { DebugJsonPanel } from "@/components/DebugJsonPanel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import {
  acceptAnalysisDraft,
  approveGate,
  generateMockAnalysisDraft,
  generateProvisioningPlan,
  getAuditTrail,
  getIntake,
  getLatestEvaluationForIntake,
  regenerateAnalysisDraft,
  rejectAnalysisDraft,
  rejectGate,
  requestChanges,
  resubmitIntake,
  reviseAnalysisDraft,
  submitIntake,
} from "@/lib/api-client";
import { formatDate, formatProjectType } from "@/lib/formatting";
import { getStatusInfo } from "@/lib/status";
import type { AgentRun, AuditEvent, IntakeEvaluation, PendingClarificationQuestion, ProjectIntakeRecord, ReviseAnalysisDraftInput } from "@/lib/types";
import { EvaluationPanel } from "@/components/EvaluationPanel";

const TABS = ["Overview", "AI Draft", "Evaluation", "Reviewed Package", "Approvals", "Distribution", "Audit Trail", "Debug"];

// ─── helpers ────────────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="section-label">{label}</dt>
      <dd className="text-sm text-brand-text">{value ?? "—"}</dd>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-brand-text mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ActionBtn({
  onClick,
  loading,
  loadingLabel,
  label,
  variant = "primary",
  disabled,
  disabledReason,
}: {
  onClick: () => void;
  loading: boolean;
  loadingLabel: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const cls = variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary";
  return (
    <div>
      <button onClick={onClick} className={cls} disabled={loading || disabled}>
        {loading ? loadingLabel : label}
      </button>
      {disabled && disabledReason && (
        <p className="text-xs text-gray-400 mt-1">{disabledReason}</p>
      )}
    </div>
  );
}

// ─── Clarification Panel ───────────────────────────────────────────────────

function ClarificationPanel({
  questions,
  missingFields,
  priorClarifications,
  busy,
  onResubmit,
}: {
  questions: PendingClarificationQuestion[];
  missingFields: string[];
  priorClarifications?: Array<{ question: string; answer: string }>;
  busy: boolean;
  onResubmit: (answers: Array<{ question: string; answer: string }>) => Promise<void>;
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [resubmitError, setResubmitError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const required = questions.filter((q) => q.required);
  const optional = questions.filter((q) => !q.required);
  const canSubmit = required.every((q) => !!answers[q.id]?.trim());

  async function handleResubmit() {
    const newTouched: Record<string, boolean> = {};
    for (const q of required) newTouched[q.id] = true;
    setTouched((prev) => ({ ...prev, ...newTouched }));
    if (!canSubmit) return;
    setResubmitError(null);
    const filled = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ question: q.question, answer: answers[q.id].trim() }));
    try {
      await onResubmit(filled);
      setSubmitted(true);
    } catch (e) {
      setResubmitError(e instanceof Error ? e.message : "Resubmission failed.");
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
            <div key={i}>
              <p className="text-xs text-gray-500 italic">{pc.question}</p>
              <p className="text-xs text-brand-text">↳ {pc.answer}</p>
            </div>
          ))}
        </div>
      )}

      {required.length > 0 && (
        <div className="space-y-3">
          {optional.length > 0 && <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Required</p>}
          {required.map((q) => {
            const isError = !!touched[q.id] && !answers[q.id]?.trim();
            return (
              <div key={q.id}>
                <label className="block text-xs font-medium text-brand-text mb-1">
                  {q.question}<span className="text-red-500 ml-1">*</span>
                </label>
                {q.reason && <p className="text-xs text-brand-muted mb-1">{q.reason}</p>}
                <textarea
                  className={`w-full border rounded-md px-2 py-1.5 text-sm text-brand-text resize-none focus:outline-none focus:ring-1 ${
                    isError ? "border-red-400 focus:ring-red-400" : "border-gray-200 focus:ring-brand-accent"
                  }`}
                  rows={2}
                  placeholder="Your answer…"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  onBlur={() => setTouched((prev) => ({ ...prev, [q.id]: true }))}
                />
                {isError && <p className="text-xs text-red-600 mt-0.5">This answer is required.</p>}
              </div>
            );
          })}
        </div>
      )}

      {optional.length > 0 && (
        <div className="space-y-3">
          {required.length > 0 && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Optional</p>}
          {optional.map((q) => (
            <div key={q.id}>
              <label className="block text-xs font-medium text-brand-text mb-1">{q.question}</label>
              {q.reason && <p className="text-xs text-brand-muted mb-1">{q.reason}</p>}
              <textarea
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm text-brand-text resize-none focus:outline-none focus:ring-1 focus:ring-brand-accent"
                rows={2}
                placeholder="Your answer… (optional)"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {resubmitError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resubmitError}</p>
      )}

      <ActionBtn
        onClick={() => { void handleResubmit(); }}
        loading={busy}
        loadingLabel="Resubmitting…"
        label="Resubmit for Evaluation"
        variant="secondary"
        disabled={!canSubmit}
        disabledReason={!canSubmit ? "Answer all required questions to resubmit." : undefined}
      />
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────

function OverviewTab({
  intake,
  audit,
  onAction,
}: {
  intake: ProjectIntakeRecord;
  audit: AuditEvent[];
  onAction: (action: string, payload?: unknown) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(action: string, payload?: unknown) {
    setBusy(action);
    setErr(null);
    try { await onAction(action, payload); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const s = intake.status;
  const hasDraft = !!intake.latestAnalysisDraft;
  const hasPkg = !!intake.reviewedProjectPackage;
  const hasPlan = !!intake.provisioningPlan;
  const gate1Done = ["devops_review", "approved", "provisioning", "distributed"].includes(s);
  const gate2Done = ["approved", "provisioning", "distributed"].includes(s);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <InfoCard title="Summary">
        <dl className="space-y-3">
          <KV label="Status" value={<StatusBadge label={getStatusInfo(s).label} variant={getStatusInfo(s).variant} />} />
          <KV label="Project Type" value={formatProjectType(intake.projectType)} />
          <KV label="Requester" value={intake.requester} />
          <KV label="Department" value={intake.department} />
          <KV label="Created" value={formatDate(intake.createdAt)} />
          <KV label="Updated" value={formatDate(intake.updatedAt)} />
          {intake.description && (
            <div>
              <dt className="section-label">Description</dt>
              <dd className="text-sm text-brand-text leading-relaxed">{intake.description}</dd>
            </div>
          )}
        </dl>
      </InfoCard>

      <InfoCard title="Required Actions">
        <ErrorBanner error={err} onDismiss={() => setErr(null)} />
        <div className="mt-3 space-y-3">
          {s === "draft" && (
            <ActionBtn onClick={() => { void run("submit"); }} loading={busy === "submit"} loadingLabel="Submitting intake…" label="Submit Intake" />
          )}
          {s === "clarification_required" && (
            <ClarificationPanel
              questions={intake.pendingClarification?.questions ?? []}
              missingFields={intake.pendingClarification?.missingFields ?? []}
              priorClarifications={intake.priorClarifications}
              busy={busy === "resubmit"}
              onResubmit={async (answers) => {
                setBusy("resubmit");
                setErr(null);
                try {
                  await onAction("resubmit", answers);
                } finally {
                  setBusy(null);
                }
              }}
            />
          )}
          {["submitted", "intake_review"].includes(s) && !hasDraft && (
            <ActionBtn onClick={() => { void run("mock_draft"); }} loading={busy === "mock_draft"} loadingLabel="Generating mock AI draft…" label="Generate Mock AI Draft" variant="secondary" />
          )}
          {hasDraft && !hasPkg && (
            <ActionBtn onClick={() => { void run("goto_draft"); }} loading={false} loadingLabel="" label="Review AI Draft" variant="secondary" />
          )}
          {hasPkg && !gate1Done && (
            <ActionBtn onClick={() => { void run("approve_gate1"); }} loading={busy === "approve_gate1"} loadingLabel="Approving Gate 1…" label="Approve Gate 1" />
          )}
          {!hasPkg && hasDraft && !gate1Done && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Gate 1 requires a reviewed project package.
            </p>
          )}
          {gate1Done && !gate2Done && (
            <ActionBtn onClick={() => { void run("approve_gate2"); }} loading={busy === "approve_gate2"} loadingLabel="Approving Gate 2…" label="Approve Gate 2" />
          )}
          {gate2Done && !hasPlan && (
            <ActionBtn onClick={() => { void run("gen_plan"); }} loading={busy === "gen_plan"} loadingLabel="Generating distribution preview…" label="Generate Distribution Preview" />
          )}
          {gate2Done && hasPlan && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Distribution preview ready. Open the Distribution tab to review.
            </p>
          )}
        </div>
      </InfoCard>

      <InfoCard title="Latest Activity">
        {audit.length === 0 ? (
          <p className="text-sm text-gray-400">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-2.5">
            {[...audit].reverse().slice(0, 8).map((ev, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 shrink-0" />
                <div>
                  <span className="font-medium text-gray-700">{ev.action}</span>
                  <span className="text-gray-400 ml-1.5">
                    {ev.actorId} · {formatDate(ev.timestamp ?? ev.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </InfoCard>
    </div>
  );
}

// ─── AI Draft Tab ──────────────────────────────────────────────────────────

function AiDraftTab({
  intake,
  onAction,
}: {
  intake: ProjectIntakeRecord;
  onAction: (action: string, payload?: unknown) => Promise<void>;
}) {
  const draft = intake.latestAnalysisDraft;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [notes, setNotes] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [reviseJson, setReviseJson] = useState("");
  const [reviseErr, setReviseErr] = useState<string | null>(null);
  const [guidance, setGuidance] = useState("");
  const regenCount = (intake.analysisDraftRegenerationCount as number) ?? 0;
  const regenLimit = 5;
  const regenExhausted = regenCount >= regenLimit;

  async function run(action: string, payload?: unknown) {
    setBusy(action);
    setErr(null);
    try { await onAction(action, payload); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  if (!draft) {
    return (
      <div className="card p-12 text-center">
        <p className="text-brand-muted font-medium">No AI draft has been generated yet.</p>
        {["submitted", "intake_review"].includes(intake.status) && (
          <button
            className="btn-primary mt-4"
            onClick={() => { void run("mock_draft"); }}
            disabled={!!busy}
          >
            {busy === "mock_draft" ? "Generating mock AI draft…" : "Generate Mock AI Draft"}
          </button>
        )}
        <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI notice */}
      <div className="bg-violet-50 border border-violet-200 text-violet-800 rounded-lg px-4 py-3 text-sm">
        <strong>AI-generated draft.</strong> This draft must be accepted or revised by a human reviewer before approval.
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: metrics */}
        <div className="card p-5 space-y-3">
          <h3 className="text-base font-semibold text-brand-text">Analysis Summary</h3>
          <dl className="space-y-2.5">
            <KV label="Review Status" value={
              <span className={`text-sm font-medium ${draft.reviewStatus === "superseded" ? "text-gray-400 line-through" : draft.reviewStatus === "accepted" ? "text-green-600" : "text-violet-700"}`}>
                {draft.reviewStatus ?? "draft"}
              </span>
            } />
            <KV label="Provider" value={draft.provider} />
            <KV label="Complexity" value={draft.complexity} />
            <KV label="Est. Story Points" value={draft.estimatedStoryPoints} />
            <KV label="Confidence" value={draft.confidence != null ? `${Math.round(draft.confidence * 100)}%` : undefined} />
            <KV label="Project Type" value={formatProjectType(draft.projectType)} />
            {draft.recommendedTechStack && draft.recommendedTechStack.length > 0 && (
              <div>
                <dt className="section-label">Tech Stack</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {draft.recommendedTechStack.map((t, i) => (
                    <span key={i} className="bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </dd>
              </div>
            )}
            {draft.missingInformation && draft.missingInformation.length > 0 && (
              <div>
                <dt className="section-label text-amber-600">Missing Information</dt>
                <dd className="space-y-0.5 mt-1">
                  {draft.missingInformation.map((m, i) => (
                    <p key={i} className="text-xs text-amber-700">• {m}</p>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Right: brief + subtasks */}
        <div className="col-span-2 space-y-4">
          {draft.brief && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Generated Brief</h3>
              <div className="space-y-3 text-sm">
                {draft.brief.problem && <div><p className="section-label">Problem</p><p className="text-brand-muted">{draft.brief.problem}</p></div>}
                {draft.brief.solution && <div><p className="section-label">Solution</p><p className="text-brand-muted">{draft.brief.solution}</p></div>}
                {draft.brief.scope && draft.brief.scope.length > 0 && (
                  <div>
                    <p className="section-label">In Scope</p>
                    <ul className="list-disc list-inside space-y-0.5 text-brand-muted">
                      {draft.brief.scope.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {draft.brief.outOfScope && draft.brief.outOfScope.length > 0 && (
                  <div>
                    <p className="section-label">Out of Scope</p>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                      {draft.brief.outOfScope.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {draft.subtasks && draft.subtasks.length > 0 && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Subtasks ({draft.subtasks.length})</h3>
              <div className="space-y-2">
                {draft.subtasks.map((t, i) => (
                  <div key={i} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-brand-text">{t.title}</p>
                      {t.description && <p className="text-xs text-brand-muted mt-0.5">{t.description}</p>}
                    </div>
                    {t.storyPoints != null && (
                      <span className="shrink-0 ml-3 bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {t.storyPoints} SP
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {draft.proposedArchitecture && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Proposed Architecture</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{draft.proposedArchitecture}</p>
            </div>
          )}

          {draft.implementationSuggestions && draft.implementationSuggestions.length > 0 && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Implementation Suggestions</h3>
              <ul className="space-y-2">
                {draft.implementationSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-brand-muted">
                    <span className="shrink-0 mt-0.5 w-5 h-5 bg-violet-100 text-violet-700 rounded-full text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.definitionOfDone && (
            <div className="card p-5 border-l-4 border-emerald-400">
              <h3 className="text-base font-semibold mb-2 text-brand-text">Definition of Done</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{draft.definitionOfDone}</p>
            </div>
          )}

          {draft.openQuestions && draft.openQuestions.length > 0 && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Open Questions</h3>
              <div className="space-y-3">
                {draft.openQuestions.map((q, i) => (
                  <div key={i} className={`rounded-lg px-4 py-3 text-sm ${q.blocking ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`font-medium ${q.blocking ? "text-red-800" : "text-amber-800"}`}>{q.question}</p>
                      {q.blocking && (
                        <span className="shrink-0 text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-semibold">blocks start</span>
                      )}
                    </div>
                    <p className={`text-xs ${q.blocking ? "text-red-600" : "text-amber-600"}`}>Ask: {q.askedOf}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {draft.keyDependencies && draft.keyDependencies.length > 0 && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Key Dependencies</h3>
              <div className="space-y-2">
                {draft.keyDependencies.map((dep, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className={`shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${dep.blocking ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                      {dep.blocking ? "blocking" : "needed"}
                    </span>
                    <div>
                      <p className="font-medium text-brand-text">{dep.item}</p>
                      <p className="text-xs text-brand-muted mt-0.5">{dep.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Draft iteration history */}
      {intake.analysisDrafts && intake.analysisDrafts.length > 1 && (
        <div className="card p-5">
          <h3 className="text-base font-semibold text-brand-text mb-3">
            Draft History <span className="text-gray-400 font-normal text-sm">({intake.analysisDrafts.length} iterations)</span>
          </h3>
          <div className="space-y-2">
            {[...intake.analysisDrafts].reverse().map((d, i) => {
              const isCurrent = d.id === draft.id;
              const statusColor =
                d.reviewStatus === "accepted" ? "bg-green-100 text-green-700" :
                d.reviewStatus === "rejected" ? "bg-red-100 text-red-700" :
                d.reviewStatus === "superseded" ? "bg-gray-100 text-gray-400" :
                "bg-violet-100 text-violet-700";
              const versionNum = intake.analysisDrafts!.length - i;
              return (
                <div
                  key={d.id}
                  className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm ${isCurrent ? "bg-violet-50 border border-violet-200" : "bg-gray-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-semibold ${isCurrent ? "text-violet-700" : "text-gray-400"}`}>
                      v{versionNum}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                      {d.reviewStatus ?? "draft"}
                    </span>
                    {isCurrent && (
                      <span className="text-xs text-violet-600 font-medium">current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {d.estimatedStoryPoints != null && (
                      <span>{d.estimatedStoryPoints} SP</span>
                    )}
                    {d.confidence != null && (
                      <span>{Math.round(d.confidence * 100)}% conf</span>
                    )}
                    {(d.createdAt ?? d.generatedAt) && (
                      <span className="font-mono">{formatDate(d.createdAt ?? d.generatedAt)}</span>
                    )}
                    <span className="font-mono text-gray-300">{d.id.slice(0, 12)}…</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review actions — only when draft is pending review */}
      {draft.reviewStatus === "draft" && !intake.reviewedProjectPackage && (
        <div className="card p-5">
          <h3 className="text-base font-semibold text-brand-text mb-4">Review Actions</h3>
          <div className="space-y-4">
            {/* Accept */}
            <div className="space-y-2">
              <label htmlFor="accept-notes" className="form-label">Reviewer Notes (accept)</label>
              <textarea
                id="accept-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-textarea h-16"
                placeholder="Optional notes…"
              />
              <button
                className="btn-primary"
                onClick={() => { void run("accept_draft", notes); }}
                disabled={!!busy}
              >
                {busy === "accept_draft" ? "Accepting draft…" : "Accept as Reviewed"}
              </button>
            </div>

            <hr className="border-gray-100" />

            {/* Revise */}
            <div>
              <button
                className="btn-secondary"
                onClick={() => {
                  if (!showRevise) {
                    setReviseJson(JSON.stringify(
                      {
                        projectType: draft.projectType,
                        complexity: draft.complexity,
                        estimatedStoryPoints: draft.estimatedStoryPoints,
                        brief: draft.brief,
                        subtasks: draft.subtasks,
                        recommendedTechStack: draft.recommendedTechStack,
                        infrastructureRequirements: draft.infrastructureRequirements,
                        missingInformation: draft.missingInformation,
                        reviewerNotes: "",
                      },
                      null,
                      2,
                    ));
                  }
                  setShowRevise((v) => !v);
                }}
              >
                {showRevise ? "Hide Revise Form" : "Revise Draft"}
              </button>
              {showRevise && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">
                    Edit the JSON below to override AI estimates. Set <code>reviewerNotes</code> to describe changes.
                  </p>
                  <textarea
                    className="form-textarea h-64 font-mono text-xs"
                    value={reviseJson}
                    onChange={(e) => { setReviseJson(e.target.value); setReviseErr(null); }}
                  />
                  {reviseErr && <p className="text-xs text-red-600">{reviseErr}</p>}
                  <button
                    className="btn-primary"
                    disabled={!!busy}
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(reviseJson) as ReviseAnalysisDraftInput;
                        void run("revise_draft", parsed);
                      } catch {
                        setReviseErr("Invalid JSON. Please fix before saving.");
                      }
                    }}
                  >
                    {busy === "revise_draft" ? "Saving reviewed package…" : "Save Reviewed Package"}
                  </button>
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* Reject */}
            <div className="space-y-2">
              <label htmlFor="reject-reason" className="form-label">Rejection Reason</label>
              <input
                id="reject-reason"
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="form-input"
                placeholder="Required reason for rejection…"
              />
              <button
                className="btn-danger"
                onClick={() => {
                  if (!rejectReason.trim()) { setErr("Rejection reason is required."); return; }
                  void run("reject_draft", rejectReason);
                }}
                disabled={!!busy}
              >
                {busy === "reject_draft" ? "Rejecting draft…" : "Reject Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regeneration loop — shown after rejection or as an alternative steering path */}
      {(draft.reviewStatus === "draft" || draft.reviewStatus === "rejected") && !intake.reviewedProjectPackage && (
        <div className="card p-5">
          {draft.reviewStatus === "rejected" && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm mb-4">
              <strong>Draft rejected.</strong> Provide guidance below to send it back to the AI for a new attempt.
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-brand-text">
              {draft.reviewStatus === "rejected" ? "Send Back to AI" : "Steer & Regenerate"}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${regenExhausted ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
              {regenCount} / {regenLimit} regenerations used
            </span>
          </div>

          {regenExhausted ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Regeneration limit reached. Accept, revise, or reject the entire request.
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="regen-guidance" className="form-label">
                Guidance for the AI <span className="text-gray-400">(min 10 characters)</span>
              </label>
              <textarea
                id="regen-guidance"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                className="form-textarea h-20"
                placeholder="Describe what the AI should focus on, change, or reconsider…"
              />
              <button
                className="btn-secondary"
                disabled={!!busy || guidance.trim().length < 10}
                onClick={() => {
                  if (guidance.trim().length < 10) { setErr("Guidance must be at least 10 characters."); return; }
                  void run("regen_draft", guidance.trim());
                }}
              >
                {busy === "regen_draft" ? "Sending back to AI…" : "Send Back to AI"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reviewed Package Tab ──────────────────────────────────────────────────

function ReviewedPackageTab({ intake }: { intake: ProjectIntakeRecord }) {
  const pkg = intake.reviewedProjectPackage;

  if (!pkg) {
    return (
      <div className="card p-12 text-center">
        <p className="text-brand-muted font-medium">No reviewed project package exists yet.</p>
        <p className="text-gray-400 text-sm mt-1">
          Accept or revise an AI draft before Gate 1 approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm">
        <strong>Human Reviewed Package.</strong> This reviewed package is the source of truth for approval and distribution preview.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 space-y-3">
          <h3 className="text-base font-semibold text-brand-text">Package Info</h3>
          <dl className="space-y-2.5">
            <KV label="Package ID" value={<span className="font-mono text-xs">{pkg.id}</span>} />
            <KV label="Source Draft ID" value={<span className="font-mono text-xs">{pkg.sourceDraftId}</span>} />
            <KV label="Decision" value={<StatusBadge label={pkg.reviewDecision ?? "reviewed"} variant="reviewed" />} />
            <KV label="Reviewed By" value={pkg.reviewedBy} />
            <KV label="Reviewed At" value={formatDate(pkg.reviewedAt)} />
            <KV label="Project Type" value={formatProjectType(pkg.projectType)} />
            <KV label="Complexity" value={pkg.complexity} />
            <KV label="Est. Story Points" value={pkg.estimatedStoryPoints} />
            {pkg.reviewerNotes && (
              <div>
                <dt className="section-label">Reviewer Notes</dt>
                <dd className="text-sm text-brand-muted italic">{pkg.reviewerNotes}</dd>
              </div>
            )}
            {pkg.recommendedTechStack && pkg.recommendedTechStack.length > 0 && (
              <div>
                <dt className="section-label">Tech Stack</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {pkg.recommendedTechStack.map((t, i) => (
                    <span key={i} className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </dd>
              </div>
            )}
            {pkg.infrastructureRequirements && pkg.infrastructureRequirements.length > 0 && (
              <div>
                <dt className="section-label">Infrastructure</dt>
                <dd className="space-y-0.5 mt-1">
                  {pkg.infrastructureRequirements.map((r, i) => <p key={i} className="text-xs text-brand-muted">• {r}</p>)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="col-span-2 space-y-4">
          {pkg.brief && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Reviewed Brief</h3>
              <div className="space-y-3 text-sm">
                {pkg.brief.problem && <div><p className="section-label">Problem</p><p className="text-brand-muted">{pkg.brief.problem}</p></div>}
                {pkg.brief.solution && <div><p className="section-label">Solution</p><p className="text-brand-muted">{pkg.brief.solution}</p></div>}
                {pkg.brief.scope && pkg.brief.scope.length > 0 && (
                  <div>
                    <p className="section-label">In Scope</p>
                    <ul className="list-disc list-inside space-y-0.5 text-brand-muted">
                      {pkg.brief.scope.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {pkg.brief.outOfScope && pkg.brief.outOfScope.length > 0 && (
                  <div>
                    <p className="section-label">Out of Scope</p>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                      {pkg.brief.outOfScope.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {pkg.subtasks && pkg.subtasks.length > 0 && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-3 text-brand-text">Reviewed Subtasks</h3>
              <div className="space-y-2">
                {pkg.subtasks.map((t, i) => (
                  <div key={i} className="flex items-start justify-between bg-emerald-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-brand-text">{t.title}</p>
                      {t.description && <p className="text-xs text-brand-muted mt-0.5">{t.description}</p>}
                    </div>
                    {t.storyPoints != null && (
                      <span className="shrink-0 ml-3 bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {t.storyPoints} SP
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Approvals Tab ─────────────────────────────────────────────────────────

function ApprovalsTab({
  intake,
  onAction,
}: {
  intake: ProjectIntakeRecord;
  onAction: (action: string, payload?: unknown) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [g1Comment, setG1Comment] = useState("");
  const [g2Comment, setG2Comment] = useState("");
  const [g1Reject, setG1Reject] = useState("");
  const [g2Reject, setG2Reject] = useState("");
  const [g2ReqChanges, setG2ReqChanges] = useState("");

  async function run(action: string, payload?: unknown) {
    setBusy(action);
    setErr(null);
    try { await onAction(action, payload); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const s = intake.status;
  const hasPkg = !!intake.reviewedProjectPackage;
  const gate1 = (intake.approvals as { gate_1?: { status?: string; actorName?: string; completedAt?: string; comment?: string } } | undefined)?.gate_1;
  const gate2 = (intake.approvals as { gate_2?: { status?: string; actorName?: string; completedAt?: string; comment?: string } } | undefined)?.gate_2;
  const gate1Done = gate1?.status === "approved" || ["devops_review", "approved", "provisioning", "distributed"].includes(s);
  const gate2Done = gate2?.status === "approved" || ["approved", "provisioning", "distributed"].includes(s);

  return (
    <div className="space-y-4">
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {/* Gate 1 */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-brand-text">Gate 1: Intake Review</h3>
            <p className="text-xs text-brand-muted mt-0.5">Required role: Intake Owner / Admin</p>
          </div>
          <StatusBadge
            label={gate1Done ? "Approved" : "Pending"}
            variant={gate1Done ? "success" : "neutral"}
          />
        </div>
        {gate1 && (
          <dl className="grid grid-cols-2 gap-2 text-sm mb-3">
            <KV label="Approved By" value={gate1.actorName} />
            <KV label="Approved At" value={formatDate(gate1.completedAt)} />
            {gate1.comment && <KV label="Comment" value={gate1.comment} />}
          </dl>
        )}
        {!gate1Done && (
          <div className="space-y-2 mt-3">
            {!hasPkg && (intake.analysisDrafts?.length ?? 0) > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Cannot approve Gate 1 until an analysis draft has been accepted or revised into a reviewed project package.
              </p>
            )}
            <input
              type="text"
              value={g1Comment}
              onChange={(e) => setG1Comment(e.target.value)}
              className="form-input"
              placeholder="Optional approval comment…"
            />
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => { void run("approve_gate1", g1Comment); }} disabled={!!busy || (!hasPkg && (intake.analysisDrafts?.length ?? 0) > 0)}>
                {busy === "approve_gate1" ? "Approving Gate 1…" : "Approve Gate 1"}
              </button>
              <button className="btn-danger" onClick={() => {
                if (!g1Reject.trim()) { setErr("Rejection reason required."); return; }
                void run("reject_gate1", g1Reject);
              }} disabled={!!busy}>
                Reject
              </button>
            </div>
            <input type="text" value={g1Reject} onChange={(e) => setG1Reject(e.target.value)} className="form-input" placeholder="Rejection reason (if rejecting)…" />
          </div>
        )}
      </div>

      {/* Gate 2 */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-brand-text">Gate 2: DevOps Review</h3>
            <p className="text-xs text-brand-muted mt-0.5">Required role: DevOps Lead / Admin</p>
          </div>
          <StatusBadge
            label={gate2Done ? "Approved" : "Pending"}
            variant={gate2Done ? "success" : "neutral"}
          />
        </div>
        {gate2 && (
          <dl className="grid grid-cols-2 gap-2 text-sm mb-3">
            <KV label="Approved By" value={gate2.actorName} />
            <KV label="Approved At" value={formatDate(gate2.completedAt)} />
            {gate2.comment && <KV label="Comment" value={gate2.comment} />}
          </dl>
        )}
        {!gate2Done && (
          <div className="space-y-2 mt-3">
            {!gate1Done && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Gate 2 requires Gate 1 approval.
              </p>
            )}
            <input
              type="text"
              value={g2Comment}
              onChange={(e) => setG2Comment(e.target.value)}
              className="form-input"
              placeholder="Optional approval comment…"
            />
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => { void run("approve_gate2", g2Comment); }} disabled={!!busy || !gate1Done}>
                {busy === "approve_gate2" ? "Approving Gate 2…" : "Approve Gate 2"}
              </button>
              <button className="btn-danger" onClick={() => {
                if (!g2Reject.trim()) { setErr("Rejection reason required."); return; }
                void run("reject_gate2", g2Reject);
              }} disabled={!!busy || !gate1Done}>
                Reject
              </button>
              <button className="btn-secondary" onClick={() => {
                if (!g2ReqChanges.trim()) { setErr("Reason required to request changes."); return; }
                void run("request_changes", g2ReqChanges);
              }} disabled={!!busy || !gate1Done}>
                {busy === "request_changes" ? "Requesting changes…" : "Request Changes"}
              </button>
            </div>
            <input type="text" value={g2Reject} onChange={(e) => setG2Reject(e.target.value)} className="form-input" placeholder="Rejection reason (permanent — archives intake)…" />
            <input type="text" value={g2ReqChanges} onChange={(e) => setG2ReqChanges(e.target.value)} className="form-input" placeholder="Request changes reason (routes back to intake review)…" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Distribution Tab ──────────────────────────────────────────────────────

function DistributionTab({
  intake,
  onAction,
}: {
  intake: ProjectIntakeRecord;
  onAction: (action: string) => Promise<void>;
}) {
  const plan = intake.provisioningPlan;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gate2Done = ["approved", "provisioning", "distributed"].includes(intake.status);

  async function run() {
    setBusy(true);
    setErr(null);
    try { await onAction("gen_plan"); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-4 py-3 text-sm">
        <strong>Dry-run preview only.</strong> No external systems have been modified.
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {!plan && (
        <div className="card p-8 text-center">
          <p className="text-brand-muted mb-4">No distribution preview has been generated yet.</p>
          {!gate2Done && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
              Distribution preview requires Gate 2 approval.
            </p>
          )}
          {gate2Done && (
            <button className="btn-primary" onClick={() => { void run(); }} disabled={busy}>
              {busy ? "Generating distribution preview…" : "Generate Distribution Preview"}
            </button>
          )}
        </div>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-base font-semibold text-brand-text mb-3">Source Metadata</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <KV label="Source Type" value={
                plan.source?.type === "reviewed_project_package"
                  ? <StatusBadge label="Reviewed Project Package" variant="reviewed" />
                  : plan.source?.type ?? "—"
              } />
              <KV label="Source ID" value={<span className="font-mono text-xs">{plan.source?.sourceId}</span>} />
              <KV label="Reviewed By" value={plan.source?.reviewedBy} />
              <KV label="Reviewed At" value={formatDate(plan.source?.reviewedAt)} />
              <KV label="Plan Status" value={<StatusBadge label={plan.status ?? "draft"} variant="info" />} />
              <KV label="Valid" value={
                <StatusBadge
                  label={plan.validation?.valid ? "Valid" : "Invalid"}
                  variant={plan.validation?.valid ? "success" : "danger"}
                />
              } />
            </dl>
          </div>

          {plan.actions && plan.actions.length > 0 && (
            <div className="card p-5">
              <h3 className="text-base font-semibold text-brand-text mb-3">
                Dry-Run Actions ({plan.actions.length})
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
                        <StatusBadge label="Dry Run" variant="info" />
                        <span className="text-gray-400 text-xs">▼</span>
                      </div>
                    </summary>
                    <div className="border-t border-gray-200 px-4 py-3">
                      {a.idempotencyKey && (
                        <p className="text-xs text-gray-400 mb-2 font-mono">Key: {a.idempotencyKey}</p>
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

      <p className="text-xs text-gray-400 text-center">
        Live provisioning is not implemented yet. Distribution requires human-approved execution in a future task.
      </p>
    </div>
  );
}

// ─── Audit Trail Tab ───────────────────────────────────────────────────────

function AuditTrailTab({ audit }: { audit: AuditEvent[] }) {
  if (audit.length === 0) {
    return (
      <div className="card p-12 text-center text-brand-muted text-sm">
        No audit events recorded yet.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Timestamp", "Actor", "Role", "Event", "Transition", "Details"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audit.map((ev, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap font-mono">
                  {formatDate(ev.timestamp ?? ev.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-700">{ev.actorId}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {ev.actorRole}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-700">
                  {ev.action}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {ev.fromState && ev.toState
                    ? `${ev.fromState} → ${ev.toState}`
                    : ev.fromState ?? ev.toState ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs">
                  {ev.metadata
                    ? <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{JSON.stringify(ev.metadata).slice(0, 60)}</span>
                    : ev.reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

function IntakeDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useActor();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get("tab") ?? "Overview";

  const [intake, setIntake] = useState<ProjectIntakeRecord | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [evaluation, setEvaluation] = useState<IntakeEvaluation | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvaluation = useCallback(async (intakeId: string) => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const result = await getLatestEvaluationForIntake(intakeId, actor);
      setEvaluation(result.evaluation);
      setAgentRuns(result.agentRuns ?? []);
    } catch {
      setEvalError("Could not load evaluation.");
    } finally {
      setEvalLoading(false);
    }
  }, [actor]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [i, a] = await Promise.all([getIntake(id, actor), getAuditTrail(id, actor)]);
      setIntake(i);
      setAudit(a);
      void loadEvaluation(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intake.");
    } finally {
      setLoading(false);
    }
  }, [id, actor, loadEvaluation]);

  useEffect(() => { void load(); }, [load]);

  function setTab(tab: string) {
    router.push(`/intakes/${id}?tab=${tab}`, { scroll: false });
  }

  async function handleAction(action: string, payload?: unknown) {
    if (!intake) return;
    const iid = intake.id;
    const draft = intake.latestAnalysisDraft;

    let updated: ProjectIntakeRecord;
    switch (action) {
      case "submit":        updated = await submitIntake(iid, actor); break;
      case "resubmit":      updated = await resubmitIntake(iid, actor, payload as Array<{ question: string; answer: string }> | undefined); break;
      case "mock_draft":    updated = await generateMockAnalysisDraft(iid, actor); break;
      case "accept_draft":  updated = await acceptAnalysisDraft(iid, draft!.id, actor, payload as string); break;
      case "reject_draft":  updated = await rejectAnalysisDraft(iid, draft!.id, actor, payload as string); break;
      case "regen_draft":   updated = await regenerateAnalysisDraft(iid, actor, payload as string); break;
      case "revise_draft":  updated = await reviseAnalysisDraft(iid, draft!.id, actor, payload as ReviseAnalysisDraftInput); break;
      case "approve_gate1": updated = await approveGate(iid, actor, payload as string); break;
      case "approve_gate2": updated = await approveGate(iid, actor, payload as string); break;
      case "reject_gate1":  updated = await rejectGate(iid, actor, payload as string); break;
      case "reject_gate2":  updated = await rejectGate(iid, actor, payload as string); break;
      case "request_changes": updated = await requestChanges(iid, actor, payload as string); break;
      case "gen_plan":      updated = await generateProvisioningPlan(iid, actor); break;
      case "goto_draft":    setTab("AI Draft"); return;
      default: return;
    }
    setIntake(updated);
    const freshAudit = await getAuditTrail(iid, actor);
    setAudit(freshAudit);
    if (["mock_draft", "regen_draft", "resubmit"].includes(action)) {
      void loadEvaluation(iid);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-brand-muted text-sm">Loading intake…</div>
    );
  }

  if (error || !intake) {
    return (
      <div className="p-8">
        <ErrorBanner error={error ?? "Intake not found."} />
      </div>
    );
  }

  const si = getStatusInfo(intake.status);

  return (
    <div className="p-8 max-w-7xl">
      {/* Breadcrumb + header */}
      <nav className="text-sm text-gray-400 mb-4">
        <Link href="/intakes" className="hover:text-indigo-600">Intakes</Link>
        <span className="mx-2">/</span>
        <span className="text-brand-text font-medium font-mono">{intake.id.slice(0, 20)}…</span>
      </nav>

      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">{intake.title}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StatusBadge label={si.label} variant={si.variant} />
            {intake.projectType && (
              <span className="text-xs text-brand-muted bg-gray-100 px-2 py-0.5 rounded-full">
                {formatProjectType(intake.projectType)}
              </span>
            )}
            {intake.requester && (
              <span className="text-xs text-brand-muted">by {intake.requester}</span>
            )}
            <span className="text-xs text-gray-400">{formatDate(intake.createdAt)}</span>
          </div>
        </div>
        <button onClick={() => { void load(); }} className="btn-secondary shrink-0">Refresh</button>
      </div>

      {/* Workflow stepper */}
      <div className="card p-4 mb-5">
        <WorkflowStepper record={intake} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-5 overflow-x-auto">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`tab-btn ${activeTab === tab ? "tab-active" : "tab-inactive"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "Overview" && (
        <OverviewTab intake={intake} audit={audit} onAction={handleAction} />
      )}
      {activeTab === "AI Draft" && (
        <AiDraftTab intake={intake} onAction={handleAction} />
      )}
      {activeTab === "Evaluation" && (
        <EvaluationPanel
          evaluation={evaluation}
          agentRuns={agentRuns}
          loading={evalLoading}
          error={evalError}
          canRegenerateAnalysis={
            ["submitted", "intake_review"].includes(intake.status) &&
            (intake.analysisDraftRegenerationCount as number ?? 0) < 5
          }
          regenerateDisabledReason={
            !["submitted", "intake_review"].includes(intake.status)
              ? "Regeneration is only available while the intake is in review."
              : (intake.analysisDraftRegenerationCount as number ?? 0) >= 5
              ? "Regeneration limit reached."
              : undefined
          }
          onRegenerateAnalysis={async (guidance) => {
            const updated = await regenerateAnalysisDraft(intake.id, actor, guidance);
            setIntake(updated);
            const freshAudit = await getAuditTrail(intake.id, actor);
            setAudit(freshAudit);
            void loadEvaluation(intake.id);
          }}
        />
      )}
      {activeTab === "Reviewed Package" && (
        <ReviewedPackageTab intake={intake} />
      )}
      {activeTab === "Approvals" && (
        <ApprovalsTab intake={intake} onAction={handleAction} />
      )}
      {activeTab === "Distribution" && (
        <DistributionTab intake={intake} onAction={handleAction} />
      )}
      {activeTab === "Audit Trail" && (
        <AuditTrailTab audit={audit} />
      )}
      {activeTab === "Debug" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
            <strong>Developer debug view.</strong> For inspection only.
          </div>
          <dl className="card p-4 space-y-2 text-sm">
            <KV label="Selected Actor" value={`${actor.name} (${actor.role})`} />
            <KV label="API Base URL" value={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"} />
          </dl>
          <DebugJsonPanel label="Full Intake JSON" data={intake} />
          <DebugJsonPanel label="Audit Trail JSON" data={audit} />
        </div>
      )}
    </div>
  );
}

export default function IntakeDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-brand-muted text-sm">Loading…</div>}>
      <IntakeDetailContent />
    </Suspense>
  );
}

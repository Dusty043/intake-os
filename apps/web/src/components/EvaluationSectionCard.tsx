"use client";

import React from "react";
import type {
  AgentRun,
  EvaluationSection,
  EvaluationSectionKind,
  EvaluationSectionProvenance,
} from "@/lib/types";

// ─── Section label map ────────────────────────────────────────────────────────

const SECTION_LABELS: Record<EvaluationSectionKind, string> = {
  intake_brief: "Intake Brief",
  clarification_questions: "Clarification",
  classification: "Classification",
  architecture: "Architecture",
  low_code_path: "Low-Code Path",
  custom_build: "Custom Build",
  risk_security: "Risk & Security",
  cost_effort: "Cost & Effort",
  work_breakdown: "Work Breakdown",
  distribution_plan: "Distribution Plan",
  synthesis: "Synthesis",
  quality_review: "Quality Review",
};

const PIPELINE_ORDER: EvaluationSectionKind[] = [
  "intake_brief",
  "clarification_questions",
  "classification",
  "architecture",
  "low_code_path",
  "custom_build",
  "risk_security",
  "cost_effort",
  "work_breakdown",
  "distribution_plan",
  "synthesis",
  "quality_review",
];

// ─── Provenance footer ────────────────────────────────────────────────────────

function AgentProvenanceFooter({ provenance }: { provenance: EvaluationSectionProvenance }) {
  const parts: string[] = [provenance.provider];
  if (provenance.model) parts.push(provenance.model);
  if (provenance.latencyMs != null) parts.push(`${provenance.latencyMs}ms`);
  if (provenance.confidence != null) parts.push(`${Math.round(provenance.confidence * 100)}% confidence`);
  if (provenance.totalTokens != null) parts.push(`${provenance.totalTokens} tokens`);
  if (provenance.estimatedCostUsd != null) parts.push(`$${provenance.estimatedCostUsd.toFixed(4)}`);
  if (provenance.warnings && provenance.warnings.length > 0) {
    parts.push(`${provenance.warnings.length} warning${provenance.warnings.length > 1 ? "s" : ""}`);
  }

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-400 font-mono">
        {parts.join(" · ")} · v{/* no version on provenance, use section version */}1
      </p>
      {provenance.warnings && provenance.warnings.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {provenance.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

type C = Record<string, unknown>;

function Chip({ label, color = "gray" }: { label: string; color?: "gray" | "violet" | "red" | "amber" | "emerald" | "blue" }) {
  const cls: Record<string, string> = {
    gray: "bg-gray-100 text-gray-600",
    violet: "bg-violet-100 text-violet-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{label}</span>;
}

function SL({ label }: { label: string }) {
  return <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</dt>;
}

function BulletList({ items }: { items: unknown[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-0.5 list-disc list-inside text-sm text-brand-muted">
      {items.map((item, i) => <li key={i}>{String(item)}</li>)}
    </ul>
  );
}

function IntakeBriefRenderer({ c }: { c: C }) {
  return (
    <div className="space-y-4 text-sm">
      {!!c["normalizedSummary"] && (
        <div>
          <SL label="Summary" />
          <p className="text-brand-muted leading-relaxed">{String(c["normalizedSummary"])}</p>
        </div>
      )}
      {Array.isArray(c["statedGoals"]) && c["statedGoals"].length > 0 && (
        <div><SL label="Stated Goals" /><BulletList items={c["statedGoals"]} /></div>
      )}
      {Array.isArray(c["successCriteria"]) && c["successCriteria"].length > 0 && (
        <div><SL label="Success Criteria" /><BulletList items={c["successCriteria"]} /></div>
      )}
      {Array.isArray(c["knownConstraints"]) && c["knownConstraints"].length > 0 && (
        <div><SL label="Known Constraints" /><BulletList items={c["knownConstraints"]} /></div>
      )}
    </div>
  );
}

function ClarificationRenderer({ c }: { c: C }) {
  const questions = Array.isArray(c["questions"]) ? c["questions"] as C[] : [];
  const missing = Array.isArray(c["missingFields"]) ? c["missingFields"] as string[] : [];
  const blocking = c["isBlocking"] === true;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <Chip label={blocking ? "Blocking" : "Non-blocking"} color={blocking ? "red" : "gray"} />
        {missing.length > 0 && (
          <span className="text-xs text-amber-700">Missing: {missing.join(", ")}</span>
        )}
      </div>
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 ${q["required"] ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}>
              <p className={`font-medium text-xs ${q["required"] ? "text-amber-800" : "text-gray-700"}`}>
                {String(q["question"])}
                {!!q["required"] && <span className="ml-1 text-red-500">*</span>}
              </p>
              {!!q["reason"] && <p className="text-xs text-gray-400 mt-0.5">{String(q["reason"])}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassificationRenderer({ c }: { c: C }) {
  const confidence = typeof c["confidence"] === "number" ? Math.round((c["confidence"] as number) * 100) : null;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        {!!c["projectType"] && <Chip label={String(c["projectType"])} color="violet" />}
        {!!c["projectSubtype"] && <Chip label={String(c["projectSubtype"])} color="blue" />}
        {!!c["recommendedDepth"] && <Chip label={`depth: ${c["recommendedDepth"]}`} color="gray" />}
        {confidence != null && <Chip label={`${confidence}% confidence`} color={confidence >= 80 ? "emerald" : confidence >= 60 ? "amber" : "red"} />}
      </div>
      {!!c["reasoning"] && (
        <div><SL label="Reasoning" /><p className="text-brand-muted leading-relaxed">{String(c["reasoning"])}</p></div>
      )}
      {Array.isArray(c["signals"]) && c["signals"].length > 0 && (
        <div><SL label="Signals" /><BulletList items={c["signals"]} /></div>
      )}
    </div>
  );
}

function ArchitectureRenderer({ c }: { c: C }) {
  return (
    <div className="space-y-4 text-sm">
      {!!c["recommendation"] && (
        <div><SL label="Recommendation" /><p className="text-brand-muted leading-relaxed">{String(c["recommendation"])}</p></div>
      )}
      {!!c["architectureStyle"] && (
        <div className="flex items-center gap-2"><SL label="Style" /><Chip label={String(c["architectureStyle"])} color="violet" /></div>
      )}
      {Array.isArray(c["recommendedTechStack"]) && c["recommendedTechStack"].length > 0 && (
        <div>
          <SL label="Tech Stack" />
          <div className="flex flex-wrap gap-1 mt-1">
            {(c["recommendedTechStack"] as string[]).map((t, i) => <Chip key={i} label={t} color="violet" />)}
          </div>
        </div>
      )}
      {Array.isArray(c["integrationPoints"]) && c["integrationPoints"].length > 0 && (
        <div><SL label="Integration Points" /><BulletList items={c["integrationPoints"]} /></div>
      )}
      {Array.isArray(c["dataStores"]) && c["dataStores"].length > 0 && (
        <div><SL label="Data Stores" /><BulletList items={c["dataStores"]} /></div>
      )}
      {Array.isArray(c["deploymentNotes"]) && c["deploymentNotes"].length > 0 && (
        <div><SL label="Deployment Notes" /><BulletList items={c["deploymentNotes"]} /></div>
      )}
      {Array.isArray(c["assumptions"]) && c["assumptions"].length > 0 && (
        <div><SL label="Assumptions" /><BulletList items={c["assumptions"]} /></div>
      )}
    </div>
  );
}

function LowCodePathRenderer({ c }: { c: C }) {
  const viable = c["viable"] === true;
  return (
    <div className="space-y-4 text-sm">
      <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2 text-xs">
        This evaluates whether the <em>downstream project</em> could use a low-code path. It does not mean Project Intake OS should use n8n.
      </div>
      <div className="flex items-center gap-2">
        <Chip label={viable ? "Viable" : "Not viable"} color={viable ? "emerald" : "red"} />
      </div>
      {!!c["fitReasoning"] && (
        <div><SL label="Reasoning" /><p className="text-brand-muted">{String(c["fitReasoning"])}</p></div>
      )}
      {Array.isArray(c["recommendedTools"]) && c["recommendedTools"].length > 0 && (
        <div>
          <SL label="Recommended Tools" />
          <div className="flex flex-wrap gap-1 mt-1">{(c["recommendedTools"] as string[]).map((t, i) => <Chip key={i} label={t} color="blue" />)}</div>
        </div>
      )}
      {Array.isArray(c["limitations"]) && c["limitations"].length > 0 && (
        <div><SL label="Limitations" /><BulletList items={c["limitations"]} /></div>
      )}
      {Array.isArray(c["whenToRejectLowCode"]) && c["whenToRejectLowCode"].length > 0 && (
        <div><SL label="When to Reject Low-Code" /><BulletList items={c["whenToRejectLowCode"]} /></div>
      )}
    </div>
  );
}

function CustomBuildRenderer({ c }: { c: C }) {
  const required = c["required"] === true;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <Chip label={required ? "Custom build required" : "Custom build not required"} color={required ? "amber" : "gray"} />
      </div>
      {!!c["rationale"] && (
        <div><SL label="Rationale" /><p className="text-brand-muted">{String(c["rationale"])}</p></div>
      )}
      {Array.isArray(c["backendNeeds"]) && c["backendNeeds"].length > 0 && (
        <div><SL label="Backend Needs" /><BulletList items={c["backendNeeds"]} /></div>
      )}
      {Array.isArray(c["frontendNeeds"]) && c["frontendNeeds"].length > 0 && (
        <div><SL label="Frontend Needs" /><BulletList items={c["frontendNeeds"]} /></div>
      )}
      {Array.isArray(c["integrationNeeds"]) && c["integrationNeeds"].length > 0 && (
        <div><SL label="Integration Needs" /><BulletList items={c["integrationNeeds"]} /></div>
      )}
      {Array.isArray(c["infrastructureNeeds"]) && c["infrastructureNeeds"].length > 0 && (
        <div><SL label="Infrastructure Needs" /><BulletList items={c["infrastructureNeeds"]} /></div>
      )}
    </div>
  );
}

const SEVERITY_COLOR: Record<string, "red" | "amber" | "gray"> = {
  high: "red",
  medium: "amber",
  low: "gray",
};

function RiskSecurityRenderer({ c }: { c: C }) {
  const risks = Array.isArray(c["risks"]) ? c["risks"] as C[] : [];
  const securityRequired = c["securityReviewRequired"] === true;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        {!!c["dataSensitivity"] && <Chip label={`sensitivity: ${c["dataSensitivity"]}`} color="amber" />}
        <Chip label={securityRequired ? "Security review required" : "No security review required"} color={securityRequired ? "red" : "gray"} />
      </div>
      {risks.length > 0 && (
        <div className="space-y-2">
          <SL label={`Risks (${risks.length})`} />
          {risks.map((r, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 border ${r["severity"] === "high" ? "bg-red-50 border-red-200" : r["severity"] === "medium" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-800">{String(r["title"])}</p>
                <div className="flex gap-1 shrink-0">
                  <Chip label={String(r["severity"])} color={SEVERITY_COLOR[String(r["severity"])] ?? "gray"} />
                  <Chip label={String(r["category"])} color="gray" />
                </div>
              </div>
              {!!r["mitigation"] && <p className="text-xs text-gray-500 mt-1">Mitigation: {String(r["mitigation"])}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CostEffortRenderer({ c }: { c: C }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        {c["estimatedStoryPoints"] != null && <Chip label={`${c["estimatedStoryPoints"]} SP`} color="violet" />}
        {c["estimatedEngineeringDays"] != null && <Chip label={`${c["estimatedEngineeringDays"]} days`} color="blue" />}
        {!!c["complexity"] && <Chip label={`complexity: ${c["complexity"]}`} color={c["complexity"] === "high" ? "red" : c["complexity"] === "medium" ? "amber" : "gray"} />}
        {!!c["infraCostSignal"] && c["infraCostSignal"] !== "none" && <Chip label={`infra: ${c["infraCostSignal"]}`} color="amber" />}
      </div>
      {Array.isArray(c["costDrivers"]) && c["costDrivers"].length > 0 && (
        <div><SL label="Cost Drivers" /><BulletList items={c["costDrivers"]} /></div>
      )}
      {Array.isArray(c["costAssumptions"]) && c["costAssumptions"].length > 0 && (
        <div><SL label="Assumptions" /><BulletList items={c["costAssumptions"]} /></div>
      )}
    </div>
  );
}

function WorkBreakdownRenderer({ c }: { c: C }) {
  const subtasks = Array.isArray(c["subtasks"]) ? c["subtasks"] as C[] : [];
  const milestones = Array.isArray(c["milestones"]) ? c["milestones"] as string[] : [];
  const deps = Array.isArray(c["dependencies"]) ? c["dependencies"] as string[] : [];

  return (
    <div className="space-y-4 text-sm">
      {subtasks.length > 0 && (
        <div className="space-y-2">
          <SL label={`Subtasks (${subtasks.length})`} />
          {subtasks.map((t, i) => (
            <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-brand-text">{String(t["title"])}</p>
                {t["estimatedHours"] != null && (
                  <span className="shrink-0 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{String(t["estimatedHours"])}h</span>
                )}
              </div>
              {!!t["description"] && <p className="text-xs text-brand-muted mt-0.5">{String(t["description"])}</p>}
              {!!t["suggestedOwnerRole"] && <p className="text-xs text-gray-400 mt-0.5">Owner: {String(t["suggestedOwnerRole"])}</p>}
              {Array.isArray(t["acceptanceCriteria"]) && t["acceptanceCriteria"].length > 0 && (
                <div className="mt-1.5">
                  <p className="text-xs text-gray-400 mb-0.5">Acceptance criteria:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(t["acceptanceCriteria"] as string[]).map((ac, j) => (
                      <li key={j} className="text-xs text-brand-muted">{ac}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {milestones.length > 0 && <div><SL label="Milestones" /><BulletList items={milestones} /></div>}
      {deps.length > 0 && <div><SL label="Dependencies" /><BulletList items={deps} /></div>}
    </div>
  );
}

function DistributionPlanRenderer({ c }: { c: C }) {
  const monday = (c["monday"] as C) ?? {};
  const github = (c["github"] as C) ?? {};
  const notes = Array.isArray(c["distributionNotes"]) ? c["distributionNotes"] as string[] : [];

  return (
    <div className="space-y-4 text-sm">
      <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-3 py-2 text-xs font-medium">
        This is a plan only. No downstream systems were modified.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SL label="Monday.com" />
            <Chip label={monday["required"] ? "Required" : "Optional"} color={monday["required"] ? "amber" : "gray"} />
          </div>
          {!!monday["suggestedBoard"] && <p className="text-xs text-brand-muted">Board: {String(monday["suggestedBoard"])}</p>}
          {!!monday["suggestedGroup"] && <p className="text-xs text-brand-muted">Group: {String(monday["suggestedGroup"])}</p>}
          {!!monday["itemName"] && <p className="text-xs text-brand-muted">Item: {String(monday["itemName"])}</p>}
          {Array.isArray(monday["notes"]) && monday["notes"].length > 0 && (
            <BulletList items={monday["notes"]} />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SL label="GitHub" />
            <Chip label={github["required"] ? "Required" : "Optional"} color={github["required"] ? "amber" : "gray"} />
          </div>
          {!!github["repositoryName"] && <p className="text-xs text-brand-muted">Repo: {String(github["repositoryName"])}</p>}
          {Array.isArray(github["issueLabels"]) && github["issueLabels"].length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(github["issueLabels"] as string[]).map((l, i) => <Chip key={i} label={l} color="gray" />)}
            </div>
          )}
          {!!github["issueBreakdownSuggested"] && (
            <p className="text-xs text-brand-muted">Issue breakdown suggested</p>
          )}
        </div>
      </div>

      {notes.length > 0 && <div><SL label="Notes" /><BulletList items={notes} /></div>}
    </div>
  );
}

function SynthesisRenderer({ c }: { c: C }) {
  const decisions = Array.isArray(c["keyDecisions"]) ? c["keyDecisions"] as string[] : [];
  const notes = Array.isArray(c["reviewNotes"]) ? c["reviewNotes"] as string[] : [];

  return (
    <div className="space-y-4 text-sm">
      {!!c["executiveSummary"] && (
        <div>
          <SL label="Executive Summary" />
          <p className="text-brand-muted leading-relaxed">{String(c["executiveSummary"])}</p>
        </div>
      )}
      {!!c["recommendedPath"] && (
        <div>
          <SL label="Recommended Path" />
          <p className="text-brand-text font-medium">{String(c["recommendedPath"])}</p>
        </div>
      )}
      {decisions.length > 0 && <div><SL label="Key Decisions" /><BulletList items={decisions} /></div>}
      {!!c["approvalReadinessSummary"] && (
        <div>
          <SL label="Approval Readiness" />
          <p className="text-brand-muted">{String(c["approvalReadinessSummary"])}</p>
        </div>
      )}
      {notes.length > 0 && <div><SL label="Review Notes" /><BulletList items={notes} /></div>}
    </div>
  );
}

function QualityReviewRenderer({ c }: { c: C }) {
  const qs = c["qualityScore"] as C | undefined;
  const strengths = Array.isArray(c["strengths"]) ? c["strengths"] as string[] : [];
  const weaknesses = Array.isArray(c["weaknesses"]) ? c["weaknesses"] as string[] : [];
  const revisions = Array.isArray(c["requiredRevisions"]) ? c["requiredRevisions"] as string[] : [];
  const warnings = Array.isArray(c["reviewerWarnings"]) ? c["reviewerWarnings"] as string[] : [];

  return (
    <div className="space-y-4 text-sm">
      {!!qs && (
        <div className="space-y-2">
          <SL label="Score" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-brand-text">{String(qs["overall"])}</span>
            <span className="text-sm text-brand-muted">/ 100 · {String(qs["readinessBand"])}</span>
          </div>
          {!!qs["dimensions"] && (
            <div className="space-y-1.5">
              {Object.entries(qs["dimensions"] as Record<string, number>).map(([dim, val]) => (
                <div key={dim} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-gray-500 capitalize">{dim.replace(/([A-Z])/g, " $1").trim()}</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${val >= 80 ? "bg-emerald-400" : val >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-mono text-gray-500">{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {strengths.length > 0 && <div><SL label="Strengths" /><BulletList items={strengths} /></div>}
      {weaknesses.length > 0 && <div><SL label="Weaknesses" /><BulletList items={weaknesses} /></div>}
      {revisions.length > 0 && <div><SL label="Required Revisions" /><BulletList items={revisions} /></div>}
      {warnings.length > 0 && (
        <div>
          <SL label="Warnings" />
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function FallbackRenderer({ c }: { c: C }) {
  return (
    <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
      {JSON.stringify(c, null, 2)}
    </pre>
  );
}

function renderSectionContent(kind: EvaluationSectionKind, c: C) {
  switch (kind) {
    case "intake_brief":           return <IntakeBriefRenderer c={c} />;
    case "clarification_questions": return <ClarificationRenderer c={c} />;
    case "classification":         return <ClassificationRenderer c={c} />;
    case "architecture":           return <ArchitectureRenderer c={c} />;
    case "low_code_path":          return <LowCodePathRenderer c={c} />;
    case "custom_build":           return <CustomBuildRenderer c={c} />;
    case "risk_security":          return <RiskSecurityRenderer c={c} />;
    case "cost_effort":            return <CostEffortRenderer c={c} />;
    case "work_breakdown":         return <WorkBreakdownRenderer c={c} />;
    case "distribution_plan":      return <DistributionPlanRenderer c={c} />;
    case "synthesis":              return <SynthesisRenderer c={c} />;
    case "quality_review":         return <QualityReviewRenderer c={c} />;
    default:                       return <FallbackRenderer c={c} />;
  }
}

// ─── Single section card ──────────────────────────────────────────────────────

export function EvaluationSectionCard({
  section,
  agentRuns,
  onUseAsGuidance,
}: {
  section: EvaluationSection;
  agentRuns?: AgentRun[];
  onUseAsGuidance?: (prefill: string) => void;
}) {
  const run = agentRuns?.find((r) => r.sectionId === section.id || r.agentRole === section.kind);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4 gap-2">
        <h3 className="text-base font-semibold text-brand-text">
          {SECTION_LABELS[section.kind] ?? section.kind}
        </h3>
        {onUseAsGuidance && (
          <button
            className="btn-secondary text-xs shrink-0"
            onClick={() =>
              onUseAsGuidance(
                `Please improve the ${section.kind} section. Make it more detailed and implementation-ready, preserving the current project scope.\n\nNote: This reruns the full evaluation, not only this section.`,
              )
            }
          >
            Use as guidance
          </button>
        )}
      </div>

      {renderSectionContent(section.kind, section.content as C)}

      <AgentProvenanceFooter provenance={{
        ...section.provenance,
        latencyMs: section.provenance.latencyMs ?? run?.latencyMs,
        totalTokens: section.provenance.totalTokens ?? run?.totalTokens,
        estimatedCostUsd: section.provenance.estimatedCostUsd ?? run?.estimatedCostUsd,
      }} />
    </div>
  );
}

// ─── Tabbed section browser ───────────────────────────────────────────────────

export function EvaluationSectionTabs({
  sections,
  agentRuns,
  onUseAsGuidance,
}: {
  sections: EvaluationSection[];
  agentRuns?: AgentRun[];
  onUseAsGuidance?: (prefill: string) => void;
}) {
  const activeSections = sections.filter((s) => !s.supersededById);
  const ordered = PIPELINE_ORDER
    .map((k) => activeSections.find((s) => s.kind === k))
    .filter(Boolean) as EvaluationSection[];

  const [activeKind, setActiveKind] = React.useState<EvaluationSectionKind | null>(
    ordered[0]?.kind ?? null,
  );

  if (!ordered.length) return <p className="text-sm text-brand-muted">No sections available.</p>;

  const current = ordered.find((s) => s.kind === activeKind) ?? ordered[0];

  return (
    <div>
      {/* Tab strip */}
      <div className="border-b border-gray-200 mb-4 overflow-x-auto">
        <div className="flex">
          {ordered.map((s) => (
            <button
              key={s.kind}
              onClick={() => setActiveKind(s.kind)}
              className={`tab-btn whitespace-nowrap ${s.kind === activeKind ? "tab-active" : "tab-inactive"}`}
            >
              {SECTION_LABELS[s.kind] ?? s.kind}
            </button>
          ))}
        </div>
      </div>
      <EvaluationSectionCard section={current} agentRuns={agentRuns} onUseAsGuidance={onUseAsGuidance} />
    </div>
  );
}

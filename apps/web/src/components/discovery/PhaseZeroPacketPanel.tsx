"use client";

import { useEffect, useState } from "react";
import type { PhaseZeroDocument, PhaseZeroPacket } from "@/lib/discovery-types";

type Props = {
  packet?: PhaseZeroPacket;
  confidence: number;
  directionSelected: boolean;
  busy: boolean;
  onGenerate: () => Promise<void>;
  onDownload: () => Promise<void>;
};

const ACTIVE_STATES = new Set(["queued", "generating", "repairing"]);

const STATE_LABELS: Record<string, string> = {
  queued: "Queued",
  generating: "Evaluating",
  repairing: "Final quality pass",
  ready: "Ready",
  ready_with_warnings: "Ready with warnings",
  failed: "Generation failed",
};

export function PhaseZeroPacketPanel({
  packet,
  confidence,
  directionSelected,
  busy,
  onGenerate,
  onDownload,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const selected = packet?.documents.find((document) => document.id === selectedId)
    ?? packet?.documents[0];

  useEffect(() => {
    if (!selectedId && packet?.documents[0]) setSelectedId(packet.documents[0].id);
  }, [packet?.documents, selectedId]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload();
    } finally {
      setDownloading(false);
    }
  };

  if (!packet) {
    return (
      <div className="h-full overflow-y-auto bg-white px-6 py-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-indigo-700">Phase 0 packet</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950 text-balance">
            Turn this Discovery into implementation-ready planning material.
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-6 text-slate-600">
            The full evaluation produces the complete 00–10 document tree, labels every assumption,
            and packages portable Markdown, Mermaid, and SVG files. It is planning material, not an approval.
          </p>

          <dl className="mt-8 divide-y divide-slate-200 border-y border-slate-200 text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-slate-500">Discovery confidence</dt>
              <dd className="font-semibold text-slate-900">{Math.round(confidence * 100)}%</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-slate-500">Direction</dt>
              <dd className="font-semibold text-slate-900">{directionSelected ? "Selected" : "Required"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-slate-500">Automatic threshold</dt>
              <dd className="font-semibold text-slate-900">Above 80%</dd>
            </div>
          </dl>

          <button
            className="btn-primary mt-6"
            disabled={!directionSelected || busy}
            onClick={() => void onGenerate()}
          >
            {busy ? "Starting…" : "Generate with current information"}
          </button>
          {!directionSelected && (
            <p className="mt-2 text-sm text-amber-700">Select a direction in Discovery before generating.</p>
          )}
        </div>
      </div>
    );
  }

  if (ACTIVE_STATES.has(packet.state)) {
    return (
      <div className="h-full bg-white px-6 py-8" aria-live="polite">
        <div className="max-w-2xl">
          <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            {STATE_LABELS[packet.state]}
          </span>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Building the Phase 0 packet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The evaluator is checking the selected direction, filling the complete document tree,
            and surfacing assumptions. You can leave this view; progress is saved to the Discovery session.
          </p>
          <div className="mt-8 space-y-3">
            {["Full evaluation", "Quality review", "Document assembly", "ZIP validation"].map((label, index) => (
              <div key={label} className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <span className={`h-2.5 w-2.5 rounded-full ${index === 0 || packet.state === "repairing" ? "bg-indigo-600 animate-pulse motion-reduce:animate-none" : "bg-slate-300"}`} />
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (packet.state === "failed") {
    return (
      <div className="h-full bg-white px-6 py-8">
        <div className="max-w-2xl rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-lg font-semibold text-red-900">Packet generation failed</h2>
          <p className="mt-2 text-sm leading-6 text-red-800">{packet.error ?? "The evaluator did not complete."}</p>
          <button className="btn-primary mt-5" disabled={busy} onClick={() => void onGenerate()}>
            {busy ? "Retrying…" : "Retry generation"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Phase 0 packet</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${packet.state === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {STATE_LABELS[packet.state]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {packet.documents.length} documents · Quality {packet.qualityScore ?? "not scored"}/100 · Unapproved planning material
          </p>
        </div>
        <button className="btn-primary" disabled={downloading} onClick={() => void handleDownload()}>
          {downloading ? "Preparing ZIP…" : "Download ZIP"}
        </button>
      </div>

      {(packet.warnings.length > 0 || packet.assumptions.length > 0) && (
        <div className="grid gap-px border-b border-slate-200 bg-slate-200 md:grid-cols-2">
          <SummaryList title="Quality warnings" items={packet.warnings} empty="No critic warnings." />
          <SummaryList title="Assumptions" items={packet.assumptions} empty="No explicit assumptions recorded." />
        </div>
      )}

      <div className="grid min-h-0 flex-1 md:grid-cols-[320px_minmax(0,1fr)]">
        <nav className="overflow-y-auto border-r border-slate-200 bg-slate-50" aria-label="Packet documents">
          {groupDocuments(packet.documents).map(([folder, documents]) => (
            <div key={folder} className="border-b border-slate-200 py-2">
              <p className="px-4 py-1.5 text-xs font-semibold text-slate-500">{folder}</p>
              {documents.map((document) => (
                <button
                  key={document.id}
                  onClick={() => setSelectedId(document.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${selected?.id === document.id ? "bg-indigo-50 font-semibold text-indigo-800" : "text-slate-700 hover:bg-white"}`}
                >
                  <span className="truncate">{fileName(document.path)}</span>
                  {document.status === "not_applicable" && <span className="text-[11px] font-medium text-slate-400">N/A</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <DocumentPreview document={selected} />
      </div>
    </div>
  );
}

function SummaryList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="bg-white px-6 py-3">
      <h3 className="text-xs font-semibold text-slate-600">{title}</h3>
      <ul className="mt-1 max-h-20 space-y-1 overflow-y-auto text-xs leading-5 text-slate-600">
        {(items.length > 0 ? items : [empty]).map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </section>
  );
}

function DocumentPreview({ document }: { document?: PhaseZeroDocument }) {
  if (!document) return <div className="p-8 text-sm text-slate-500">Select a document to preview.</div>;
  return (
    <article className="min-w-0 overflow-y-auto px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{fileName(document.path)}</h3>
          <p className="mt-1 font-mono text-xs text-slate-500">{document.path}</p>
        </div>
        <span className="text-xs font-medium text-slate-500">Confidence {Math.round(document.confidence * 100)}%</span>
      </div>
      <pre className="max-w-[75ch] whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-slate-800">
        {document.content}
      </pre>
    </article>
  );
}

function groupDocuments(documents: PhaseZeroDocument[]): Array<[string, PhaseZeroDocument[]]> {
  const groups = new Map<string, PhaseZeroDocument[]>();
  for (const document of documents) {
    const folder = document.path.split("/")[0];
    groups.set(folder, [...(groups.get(folder) ?? []), document]);
  }
  return [...groups.entries()];
}

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

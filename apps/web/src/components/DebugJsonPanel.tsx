"use client";

import { useState } from "react";

type Props = { label: string; data: unknown };

export function DebugJsonPanel({ label, data }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre className="bg-slate-900 text-green-400 text-xs p-4 overflow-x-auto max-h-96 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

export function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="section-label">{label}</dt>
      <dd className="text-sm text-brand-text">{value ?? "—"}</dd>
    </div>
  );
}

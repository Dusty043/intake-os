export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateShort(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-AU", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatProjectType(pt?: string): string {
  if (!pt) return "—";
  return pt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

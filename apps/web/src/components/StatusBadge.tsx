import { VARIANT_CLASSES } from "@/lib/status";
import type { BadgeVariant } from "@/lib/status";

type Props = { label: string; variant: BadgeVariant; className?: string };

export function StatusBadge({ label, variant, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {label}
    </span>
  );
}

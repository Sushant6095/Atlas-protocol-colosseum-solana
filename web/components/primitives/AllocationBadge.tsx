// <AllocationBadge> — count chip used in dashboard vault rows.
//
// Renders a tinted circle with a 1–2 digit count plus an optional
// label. The dot count badges on Lulo's allocation rows ("3 / 11
// strategies") are the reference. Atlas uses the electric accent by
// default; switch tone for warn/danger states.

"use client";

import { memo } from "react";
import { cn } from "./cn";

export type AllocationTone = "electric" | "zk" | "execute" | "warn" | "danger" | "neutral";

const TONE: Record<AllocationTone, { fg: string; bg: string }> = {
  electric: { fg: "var(--color-accent-electric)", bg: "color-mix(in oklab, var(--color-accent-electric) 14%, transparent)" },
  zk:       { fg: "var(--color-accent-zk)",       bg: "color-mix(in oklab, var(--color-accent-zk) 14%, transparent)" },
  execute:  { fg: "var(--color-accent-execute)",  bg: "color-mix(in oklab, var(--color-accent-execute) 14%, transparent)" },
  warn:     { fg: "var(--color-accent-warn)",     bg: "color-mix(in oklab, var(--color-accent-warn) 14%, transparent)" },
  danger:   { fg: "var(--color-accent-danger)",   bg: "color-mix(in oklab, var(--color-accent-danger) 14%, transparent)" },
  neutral:  { fg: "var(--color-ink-secondary)",   bg: "var(--color-surface-sunken)" },
};

export interface AllocationBadgeProps {
  count: number;
  total?: number;
  label?: string;
  tone?: AllocationTone;
  className?: string;
}

function AllocationBadgeImpl({
  count, total, label, tone = "electric", className,
}: AllocationBadgeProps): JSX.Element {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2 py-0.5",
        "font-mono text-[11px] uppercase tracking-[0.12em]",
        className,
      )}
      style={{ background: t.bg, color: t.fg }}
    >
      <span className="font-semibold">
        {count}{typeof total === "number" && (
          <span className="opacity-60"> / {total}</span>
        )}
      </span>
      {label && <span className="opacity-80">{label}</span>}
    </span>
  );
}

export const AllocationBadge = memo(AllocationBadgeImpl);

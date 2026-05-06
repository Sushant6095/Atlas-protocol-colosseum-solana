// RegimeBadge — risk_on / neutral / defensive / crisis label
// (Phase 22 §7.1, Phase 04 regime classifier).

"use client";

import { memo } from "react";
import { cn } from "@/components/primitives";

export type Regime = "risk_on" | "neutral" | "defensive" | "crisis";

interface RegimeBadgeProps {
  regime: Regime;
  className?: string;
}

const CLASS: Record<Regime, string> = {
  risk_on:   "bg-[color:var(--color-accent-execute)]/15 text-[color:var(--color-accent-execute)]",
  neutral:   "bg-[color:var(--color-line-medium)] text-[color:var(--color-ink-secondary)]",
  defensive: "bg-[color:var(--color-accent-warn)]/15 text-[color:var(--color-accent-warn)]",
  crisis:    "bg-[color:var(--color-accent-danger)]/15 text-[color:var(--color-accent-danger)]",
};

const LABEL: Record<Regime, string> = {
  risk_on:   "risk-on",
  neutral:   "neutral",
  defensive: "defensive",
  crisis:    "crisis",
};

function RegimeBadgeImpl({ regime, className }: RegimeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-xs)] px-2 py-0.5",
        "font-mono text-[10px] uppercase tracking-[0.08em]",
        CLASS[regime],
        className,
      )}
    >
      {LABEL[regime]}
    </span>
  );
}

export const RegimeBadge = memo(RegimeBadgeImpl);
RegimeBadge.displayName = "RegimeBadge";

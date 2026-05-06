// BottomStrip — 32px footer strip for the TerminalShell (Phase 23 §1).
//
// Renders: pending bundles count, last rebalance age, runway p10 days
// (treasury), and the keyboard-hint cluster.

"use client";

import { memo } from "react";
import { cn } from "@/components/primitives";

interface BottomStripProps {
  pendingCount?: number;
  lastRebalanceSecondsAgo?: number;
  runwayP10Days?: number;
  hints?: { keys: string; label: string }[];
}

function BottomStripImpl({
  pendingCount = 0,
  lastRebalanceSecondsAgo,
  runwayP10Days,
  hints,
}: BottomStripProps) {
  return (
    <footer className={cn(
      "h-8 px-4 flex items-center gap-4 text-[10px] font-mono",
      "border-t border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-sunken)]",
      "text-[color:var(--color-ink-tertiary)]",
    )}>
      <Cell label="pending"        value={pendingCount.toString()} />
      <Cell label="last rebalance" value={fmtAge(lastRebalanceSecondsAgo)} />
      {runwayP10Days != null
        ? <Cell label="runway p10"
                value={`${runwayP10Days}d`}
                valueClass={runwayP10Days < 30 ? "text-[color:var(--color-accent-danger)]"
                          : runwayP10Days < 60 ? "text-[color:var(--color-accent-warn)]"
                          : "text-[color:var(--color-accent-execute)]"} />
        : null}
      <div className="flex-1" />
      {hints?.map((h) => (
        <span key={h.keys} className="inline-flex items-center gap-1">
          <kbd className="px-1.5 py-px border border-[color:var(--color-line-medium)] rounded-[var(--radius-xs)] text-[color:var(--color-ink-secondary)]">
            {h.keys}
          </kbd>
          <span>{h.label}</span>
        </span>
      ))}
    </footer>
  );
}

function Cell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="uppercase tracking-[0.08em]">{label}</span>
      <span className={valueClass ?? "text-[color:var(--color-ink-secondary)]"}>{value}</span>
    </span>
  );
}

function fmtAge(s?: number): string {
  if (s == null) return "—";
  if (s < 90) return `${s}s ago`;
  if (s < 60 * 60) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3_600)}h ago`;
}

export const BottomStrip = memo(BottomStripImpl);
BottomStrip.displayName = "BottomStrip";

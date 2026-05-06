// Tile — KPI display: a label, a value (mono), and optional accent.
// Used by /infra, vault terminal, intelligence dashboard.

"use client";

import { memo } from "react";
import { cn } from "./cn";

export interface TileProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "electric" | "zk" | "proof" | "execute" | "warn" | "danger";
  /** Compact mono for the value (default true). */
  mono?: boolean;
  className?: string;
}

const ACCENT_VALUE_CLASS = {
  electric: "text-[color:var(--color-accent-electric)]",
  zk:       "text-[color:var(--color-accent-zk)]",
  proof:    "text-[color:var(--color-accent-proof)]",
  execute:  "text-[color:var(--color-accent-execute)]",
  warn:     "text-[color:var(--color-accent-warn)]",
  danger:   "text-[color:var(--color-accent-danger)]",
} as const;

function TileImpl({ label, value, hint, accent, mono = true, className }: TileProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
        {label}
      </span>
      <span
        className={cn(
          mono ? "font-mono" : "text-display",
          "text-[22px] leading-[26px] font-semibold text-[color:var(--color-ink-primary)]",
          accent && ACCENT_VALUE_CLASS[accent],
        )}
      >
        {value}
      </span>
      {hint ? (
        <span className="text-[11px] leading-[15px] text-[color:var(--color-ink-tertiary)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const Tile = memo(TileImpl);
Tile.displayName = "Tile";

// Panel — the workhorse surface. Used as the container for charts,
// tables, intelligence cards, terminal panes. Uses tokens for every
// surface treatment; no raw colors.

"use client";

import { memo } from "react";
import { cn } from "./cn";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual surface. Defaults to `raised`. */
  surface?: "raised" | "sunken" | "glass";
  /** Density preset (Phase 20 §1.3). */
  density?: "dense" | "default" | "cinematic";
  /** Optional accent border + glow. */
  accent?: "electric" | "zk" | "proof" | "execute" | "warn" | "danger";
}

const SURFACE_CLASS = {
  raised: "surface-raised",
  sunken: "surface-sunken",
  glass:  "surface-glass",
} as const;

const DENSITY_CLASS = {
  dense:     "px-4 py-6",
  default:   "px-6 py-10",
  cinematic: "px-20 py-24",
} as const;

const ACCENT_CLASS = {
  electric: "shadow-[var(--shadow-glow-electric)] border-[color:var(--color-accent-electric)]/40",
  zk:       "shadow-[var(--shadow-glow-zk)] border-[color:var(--color-accent-zk)]/40",
  proof:    "shadow-[var(--shadow-glow-proof)] border-[color:var(--color-accent-proof)]/40",
  execute:  "shadow-[var(--shadow-glow-execute)] border-[color:var(--color-accent-execute)]/40",
  warn:     "border-[color:var(--color-accent-warn)]/40",
  danger:   "border-[color:var(--color-accent-danger)]/40",
} as const;

function PanelImpl({
  surface = "raised",
  density = "default",
  accent,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-[var(--radius-md)]",
        SURFACE_CLASS[surface],
        DENSITY_CLASS[density],
        accent && ACCENT_CLASS[accent],
        className,
      )}
    >
      {children}
    </div>
  );
}

export const Panel = memo(PanelImpl);
Panel.displayName = "Panel";

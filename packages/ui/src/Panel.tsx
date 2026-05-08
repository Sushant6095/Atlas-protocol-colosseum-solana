// <Panel> — workhorse surface (raised / sunken / glass).
// Atlas's institutional radius cap is 12px (rounded-lg).

"use client";

import { memo, type ReactNode } from "react";
import { clsx } from "clsx";

export interface PanelProps {
  surface?: "raised" | "sunken" | "glass";
  density?: "dense" | "default" | "cinematic";
  accent?: "electric" | "zk" | "proof" | "execute" | "warn" | "danger";
  className?: string;
  children: ReactNode;
}

const SURFACE_BG: Record<NonNullable<PanelProps["surface"]>, string> = {
  raised: "var(--color-surface-raised)",
  sunken: "var(--color-surface-sunken)",
  glass:  "var(--color-surface-glass)",
};

const PAD: Record<NonNullable<PanelProps["density"]>, string> = {
  dense:     "px-4 py-6",
  default:   "px-6 py-8",
  cinematic: "px-12 py-16",
};

function PanelImpl({
  surface = "raised", density = "default", accent, className, children,
}: PanelProps): JSX.Element {
  return (
    <div
      className={clsx("rounded-[var(--radius-lg)] border", PAD[density], className)}
      style={{
        background: SURFACE_BG[surface],
        borderColor: "var(--color-line-medium)",
        boxShadow: accent ? `0 0 24px color-mix(in oklab, var(--color-accent-${accent}) 18%, transparent)` : undefined,
      }}
    >
      {children}
    </div>
  );
}

export const Panel = memo(PanelImpl);
Panel.displayName = "Panel";

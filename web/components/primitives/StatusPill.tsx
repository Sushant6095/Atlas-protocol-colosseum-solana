// StatusPill — compact mono pill with dot prefix. The single
// component used to surface execution/proof/connection state.
//
// Variants drive both the dot colour and the border tint.
// `live` is the only variant that pulses; everything else is
// static so the eye lands on what's actually moving.

"use client";

import { memo, type ReactNode } from "react";
import { cn } from "./cn";

export type StatusVariant =
  | "live"     // streaming, healthy
  | "idle"     // open but no recent ticks
  | "warn"     // soft warning
  | "danger"   // hard failure / oracle anomaly
  | "proof"    // verifying / verified
  | "zk"       // zk surface
  | "execute"; // routing / settled

export interface StatusPillProps {
  variant: StatusVariant;
  children: ReactNode;
  /** Replaces the dot with a custom icon (lucide-react). */
  icon?: ReactNode;
  className?: string;
  /** Compact mode for inline-with-text use. */
  compact?: boolean;
}

const TONE: Record<StatusVariant, { fg: string; dot: string; ring: string }> = {
  live:    { fg: "var(--color-accent-execute)", dot: "var(--color-accent-execute)", ring: "rgba(60,227,154,0.30)" },
  idle:    { fg: "var(--color-ink-tertiary)",   dot: "var(--color-ink-tertiary)",   ring: "rgba(255,255,255,0.08)" },
  warn:    { fg: "var(--color-accent-warn)",    dot: "var(--color-accent-warn)",    ring: "rgba(247,185,85,0.30)" },
  danger:  { fg: "var(--color-accent-danger)",  dot: "var(--color-accent-danger)",  ring: "rgba(255,97,102,0.30)" },
  proof:   { fg: "var(--color-accent-proof)",   dot: "var(--color-accent-proof)",   ring: "rgba(244,120,198,0.30)" },
  zk:      { fg: "var(--color-accent-zk)",      dot: "var(--color-accent-zk)",      ring: "rgba(166,130,255,0.30)" },
  execute: { fg: "var(--color-accent-electric)",dot: "var(--color-accent-electric)",ring: "rgba(63,140,255,0.30)" },
};

function StatusPillImpl({ variant, children, icon, className, compact }: StatusPillProps): JSX.Element {
  const t = TONE[variant];
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-mono",
        "border",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        "uppercase tracking-[0.08em]",
        className,
      )}
      style={{
        color: t.fg,
        borderColor: t.ring,
        background: "color-mix(in oklab, currentColor 6%, var(--color-surface-base))",
      }}
    >
      {icon ? (
        <span className="grid place-items-center" style={{ color: t.dot }}>
          {icon}
        </span>
      ) : (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "live" && "animate-[atlas-pulse_1.6s_ease-in-out_infinite]",
          )}
          style={{ background: t.dot }}
          aria-hidden
        />
      )}
      <span>{children}</span>
    </span>
  );
}

export const StatusPill = memo(StatusPillImpl);
StatusPill.displayName = "StatusPill";

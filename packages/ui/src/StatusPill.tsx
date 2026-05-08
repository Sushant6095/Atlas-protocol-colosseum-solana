// <StatusPill> — compact mono pill with leading dot.
//
// Variants drive both the dot colour and the border tint.
// `live` is the only variant that pulses; everything else is static.

"use client";

import { memo, type ReactNode } from "react";
import { clsx } from "clsx";

export type StatusVariant =
  | "live" | "idle" | "warn" | "danger" | "proof" | "zk" | "execute";

export interface StatusPillProps {
  variant: StatusVariant;
  children: ReactNode;
  compact?: boolean;
  className?: string;
}

const TONE: Record<StatusVariant, { fg: string; ring: string }> = {
  live:    { fg: "var(--color-accent-execute)", ring: "rgba(60,227,154,0.30)" },
  idle:    { fg: "var(--color-ink-tertiary)",   ring: "rgba(255,255,255,0.08)" },
  warn:    { fg: "var(--color-accent-warn)",    ring: "rgba(247,185,85,0.30)" },
  danger:  { fg: "var(--color-accent-danger)",  ring: "rgba(255,97,102,0.30)" },
  proof:   { fg: "var(--color-accent-proof)",   ring: "rgba(244,120,198,0.30)" },
  zk:      { fg: "var(--color-accent-zk)",      ring: "rgba(166,130,255,0.30)" },
  execute: { fg: "var(--color-accent-electric)",ring: "rgba(63,140,255,0.30)" },
};

function StatusPillImpl({ variant, children, compact, className }: StatusPillProps): JSX.Element {
  const t = TONE[variant];
  return (
    <span
      role="status"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-mono border uppercase tracking-[0.08em]",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className,
      )}
      style={{
        color: t.fg,
        borderColor: t.ring,
        background: "color-mix(in oklab, currentColor 6%, var(--color-surface-base))",
      }}
    >
      <span
        aria-hidden
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          variant === "live" && "animate-[atlas-ui-pulse_1.5s_ease-in-out_infinite]",
        )}
        style={{ background: t.fg }}
      />
      <span>{children}</span>
      <style>{`
        @keyframes atlas-ui-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:.55; transform:scale(1.4); }
        }
      `}</style>
    </span>
  );
}

export const StatusPill = memo(StatusPillImpl);
StatusPill.displayName = "StatusPill";

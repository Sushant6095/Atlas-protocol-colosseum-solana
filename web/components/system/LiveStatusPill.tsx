// LiveStatusPill — realtime connection indicator (Phase 21 §4.2).
//
// Reads from the realtime store. Shows: live (green dot), connecting
// (amber pulse), degraded (orange — "live updates paused"), closed.
// Hidden when the realtime transport hasn't been initialised.

"use client";

import { memo } from "react";
import { useRealtimeStatus } from "@/lib/realtime";
import { cn } from "@/components/primitives";

const STATUS_CLASS = {
  open:       "bg-[color:var(--color-accent-execute)]",
  connecting: "bg-[color:var(--color-accent-warn)] animate-pulse",
  degraded:   "bg-[color:var(--color-accent-warn)]",
  closed:     "bg-[color:var(--color-ink-tertiary)]",
} as const;

const STATUS_LABEL = {
  open:       "live",
  connecting: "connecting",
  degraded:   "live updates paused",
  closed:     "offline",
} as const;

function LiveStatusPillImpl() {
  const status = useRealtimeStatus();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2 rounded-[var(--radius-xs)]",
        "text-[10px] uppercase tracking-[0.08em]",
        "border border-[color:var(--color-line-soft)]",
        "bg-[color:var(--color-surface-raised)]",
        status === "degraded"
          ? "text-[color:var(--color-accent-warn)]"
          : "text-[color:var(--color-ink-tertiary)]",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_CLASS[status])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const LiveStatusPill = memo(LiveStatusPillImpl);
LiveStatusPill.displayName = "LiveStatusPill";

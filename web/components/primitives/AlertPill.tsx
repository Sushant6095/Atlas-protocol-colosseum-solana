// AlertPill — short, glanceable status / severity tag. Used by the
// /infra observatory, the freshness monitor, the pending queue, and
// the Squads approval flow.

"use client";

import { memo } from "react";
import { cn } from "./cn";

export type AlertSeverity =
  | "info"
  | "ok"
  | "warn"
  | "danger"
  | "zk"
  | "proof"
  | "execute"
  | "muted";

export interface AlertPillProps {
  severity: AlertSeverity;
  children: React.ReactNode;
  className?: string;
}

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  info:    "bg-[color:var(--color-accent-electric)]/15 text-[color:var(--color-accent-electric)]",
  ok:      "bg-[color:var(--color-accent-execute)]/15 text-[color:var(--color-accent-execute)]",
  warn:    "bg-[color:var(--color-accent-warn)]/15 text-[color:var(--color-accent-warn)]",
  danger:  "bg-[color:var(--color-accent-danger)]/15 text-[color:var(--color-accent-danger)]",
  zk:      "bg-[color:var(--color-accent-zk)]/15 text-[color:var(--color-accent-zk)]",
  proof:   "bg-[color:var(--color-accent-proof)]/15 text-[color:var(--color-accent-proof)]",
  execute: "bg-[color:var(--color-accent-execute)]/15 text-[color:var(--color-accent-execute)]",
  muted:   "bg-[color:var(--color-line-medium)] text-[color:var(--color-ink-tertiary)]",
};

function AlertPillImpl({ severity, children, className }: AlertPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-2 py-0.5",
        "font-medium uppercase tracking-wider text-[10px] leading-[14px]",
        SEVERITY_CLASS[severity],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const AlertPill = memo(AlertPillImpl);
AlertPill.displayName = "AlertPill";

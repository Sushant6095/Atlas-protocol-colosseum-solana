// <Tooltip> — minimal hover/focus tooltip.
//
// CSS-only positioning + delayed reveal (200ms). Keyboard-friendly
// via focus-within. No portal — relies on z-index above sibling
// content. For overlay-heavy contexts, prefer Radix; this is the
// hackathon-fast version that costs zero deps and renders crisp.

"use client";

import { type ReactNode } from "react";
import { cn } from "./cn";

export interface TooltipProps {
  label: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  delayMs?: number;
  children: ReactNode;
  className?: string;
}

const SIDE_STYLE: Record<NonNullable<TooltipProps["side"]>, string> = {
  top:    "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left:   "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right:  "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

export function Tooltip({
  label, side = "top", align = "center", delayMs = 200, children, className,
}: TooltipProps): JSX.Element {
  const alignOverride =
    side === "top" || side === "bottom"
      ? align === "start" ? "left-0 translate-x-0" : align === "end" ? "left-auto right-0 translate-x-0" : ""
      : align === "start" ? "top-0 translate-y-0" : align === "end" ? "top-auto bottom-0 translate-y-0" : "";

  return (
    <span className={cn("relative inline-flex group/tt", className)} tabIndex={-1}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[60] whitespace-nowrap",
          "rounded-[var(--radius-sm)] border px-2 py-1",
          "font-mono text-[10px] uppercase tracking-[0.12em]",
          "opacity-0 translate-y-0.5",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          "group-hover/tt:translate-y-0 group-focus-within/tt:translate-y-0",
          "transition-[opacity,transform] ease-[var(--ease-glide)]",
          SIDE_STYLE[side],
          alignOverride,
        )}
        style={{
          background: "var(--color-surface-raised)",
          borderColor: "var(--color-line-medium)",
          color: "var(--color-ink-secondary)",
          transitionDuration: `${Math.max(120, Math.min(delayMs, 600))}ms`,
          transitionDelay: `${Math.max(0, Math.min(delayMs, 600))}ms`,
        }}
      >
        {label}
      </span>
    </span>
  );
}

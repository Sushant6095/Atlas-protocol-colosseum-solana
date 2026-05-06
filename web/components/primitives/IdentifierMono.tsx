// IdentifierMono — short-form display for hashes / vault ids /
// signatures / addresses. Always mono. Click-to-copy on demand.
// Tooltip-friendly: caller supplies the full string; we render a
// short head…tail.

"use client";

import { memo, useCallback, useState } from "react";
import { cn } from "./cn";

export interface IdentifierMonoProps {
  /** Full identifier — hex32 / base58 / signature, etc. */
  value: string;
  /** Characters from the head/tail when shortened. Defaults to 6/4. */
  head?: number;
  tail?: number;
  /** Show full value instead of `head…tail`. */
  full?: boolean;
  /** Render as click-to-copy. */
  copy?: boolean;
  /** Visual size. */
  size?: "xs" | "sm" | "md";
  className?: string;
  /** Aria label override. */
  "aria-label"?: string;
}

const SIZE_CLASS = {
  xs: "text-[11px] leading-[15px]",
  sm: "text-[12px] leading-[16px]",
  md: "text-[13px] leading-[18px]",
} as const;

function shorten(s: string, head: number, tail: number): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function IdentifierMonoImpl({
  value,
  head = 6,
  tail = 4,
  full = false,
  copy = false,
  size = "sm",
  className,
  "aria-label": ariaLabel,
}: IdentifierMonoProps) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    if (!copy || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_200);
    } catch {
      // swallow — clipboard isn't a tested path
    }
  }, [copy, value]);

  const display = full ? value : shorten(value, head, tail);
  const baseClass = cn(
    "font-mono tracking-tight text-[color:var(--color-ink-secondary)]",
    SIZE_CLASS[size],
    className,
  );

  if (!copy) {
    return (
      <span className={baseClass} title={value} aria-label={ariaLabel ?? value}>
        {display}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        baseClass,
        "inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-1 -mx-1",
        "hover:bg-[color:var(--color-line-soft)] hover:text-[color:var(--color-ink-primary)]",
        "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-precise)]",
      )}
      title={value}
      aria-label={ariaLabel ?? value}
    >
      {display}
      <span
        className={cn(
          "text-[10px] uppercase tracking-wider transition-opacity",
          copied ? "text-[color:var(--color-accent-execute)] opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        copied
      </span>
    </button>
  );
}

export const IdentifierMono = memo(IdentifierMonoImpl);
IdentifierMono.displayName = "IdentifierMono";

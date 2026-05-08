// Identifier — pubkey / hash / signature display.
//
// Truncates middle (4 + … + 4 by default), copies on click, surfaces
// the full value on hover. Mono everywhere; no narrative weight on
// these strings — they're addresses, not prose.
//
// Wraps the older `IdentifierMono` so existing call sites keep
// working while new code reaches for `Identifier`.

"use client";

import { memo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./cn";

export interface IdentifierProps {
  value: string;
  /** Characters to show on each side of the ellipsis. Default 4. */
  edge?: number;
  /** Always show the full value, no truncation. */
  full?: boolean;
  /** Optional custom label preceding the value. */
  label?: string;
  /** Tone — drives the value colour, not the label. */
  tone?: "default" | "accent" | "zk" | "proof" | "execute" | "muted";
  /** Display size. */
  size?: "xs" | "sm" | "md";
  /** Disable click-to-copy. Default false. */
  staticCopy?: boolean;
  className?: string;
}

const TONE: Record<NonNullable<IdentifierProps["tone"]>, string> = {
  default: "var(--color-ink-primary)",
  accent:  "var(--color-accent-electric)",
  zk:      "var(--color-accent-zk)",
  proof:   "var(--color-accent-proof)",
  execute: "var(--color-accent-execute)",
  muted:   "var(--color-ink-tertiary)",
};

const SIZE_CLASS: Record<NonNullable<IdentifierProps["size"]>, string> = {
  xs: "text-[10px] leading-[14px]",
  sm: "text-[11px] leading-[15px]",
  md: "text-[12px] leading-[18px]",
};

function IdentifierImpl({
  value, edge = 4, full = false, label, tone = "default",
  size = "sm", staticCopy = false, className,
}: IdentifierProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const display = full || value.length <= edge * 2 + 1
    ? value
    : `${value.slice(0, edge)}…${value.slice(-edge)}`;

  async function copy(): Promise<void> {
    if (staticCopy) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard denied */ }
  }

  const interactive = !staticCopy;

  const Tag: React.ElementType = interactive ? "button" : "span";

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => void copy() : undefined}
      title={interactive ? `Click to copy · ${value}` : value}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono align-baseline",
        SIZE_CLASS[size],
        interactive && "hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)] rounded-[2px]",
        className,
      )}
      style={{ color: TONE[tone] }}
    >
      {label && (
        <span className="text-[color:var(--color-ink-tertiary)] uppercase tracking-[0.06em] mr-0.5">
          {label}
        </span>
      )}
      <span>{display}</span>
      {interactive && (
        <span aria-hidden className="text-[color:var(--color-ink-tertiary)] grid place-items-center">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </span>
      )}
    </Tag>
  );
}

export const Identifier = memo(IdentifierImpl);
Identifier.displayName = "Identifier";

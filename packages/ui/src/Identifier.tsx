// <Identifier> — pubkey / hash / signature display with copy.
// Click → copies. Hover → tooltip via title attribute.

"use client";

import { memo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { clsx } from "clsx";

export interface IdentifierProps {
  value: string;
  edge?: number;
  full?: boolean;
  /** Click-through to Solana Explorer. cluster: mainnet | devnet | testnet */
  cluster?: "mainnet" | "devnet" | "testnet";
  /** "tx" → /tx/, "address" → /address/ etc. */
  kind?: "tx" | "address" | "block";
  size?: "xs" | "sm" | "md";
  tone?: "default" | "accent" | "muted";
  className?: string;
}

const TONE: Record<NonNullable<IdentifierProps["tone"]>, string> = {
  default: "var(--color-ink-primary)",
  accent:  "var(--color-accent-electric)",
  muted:   "var(--color-ink-tertiary)",
};

function IdentifierImpl({
  value, edge = 4, full = false, cluster, kind, size = "sm",
  tone = "default", className,
}: IdentifierProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const display = full || value.length <= edge * 2 + 1
    ? value
    : `${value.slice(0, edge)}…${value.slice(-edge)}`;

  async function copy(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard denied */ }
  }

  const px = size === "xs" ? 10 : size === "sm" ? 11 : 12;

  // Optional explorer link.
  const explorerUrl = cluster && kind
    ? `https://solscan.io/${kind}/${value}${cluster !== "mainnet" ? `?cluster=${cluster}` : ""}`
    : null;

  return (
    <span
      className={clsx("inline-flex items-center gap-1.5 font-mono align-baseline", className)}
      title={value}
      style={{ fontSize: px, color: TONE[tone] }}
    >
      <span>{display}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy"}
        className="grid place-items-center transition-colors hover:text-[color:var(--color-ink-primary)]"
        style={{ color: "var(--color-ink-tertiary)" }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="hover:text-[color:var(--color-accent-electric)] transition-colors"
          style={{ color: "var(--color-ink-tertiary)" }}
          aria-label="Open in Solana Explorer"
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      )}
    </span>
  );
}

export const Identifier = memo(IdentifierImpl);
Identifier.displayName = "Identifier";

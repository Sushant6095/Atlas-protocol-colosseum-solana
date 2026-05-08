// <ProofBadge> — compact "this is proof-anchored" affordance.
//
// Renders the explanation/public-input hash short-id, a verified
// check, and click-throughs to /proofs/{hash} (where the judge can
// hit "verify in browser" — the demo-moment-1 path).
//
// Not a generic pill: only emit this when there's a real proof on
// the wire. Use `StatusPill` for "pending" / "queued" states.

"use client";

import { memo } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "./cn";
import { Identifier } from "./Identifier";

export type ProofVariant = "verified" | "verifying" | "rejected";

export interface ProofBadgeProps {
  hash: string;
  txSig?: string;
  variant?: ProofVariant;
  href?: string;
  compact?: boolean;
  className?: string;
}

const TONE: Record<ProofVariant, { fg: string; ring: string; label: string; Icon: typeof ShieldCheck }> = {
  verified:  { fg: "var(--color-accent-execute)", ring: "rgba(60,227,154,0.30)",  label: "Verified",  Icon: ShieldCheck },
  verifying: { fg: "var(--color-accent-zk)",      ring: "rgba(166,130,255,0.30)", label: "Verifying", Icon: Sparkles    },
  rejected:  { fg: "var(--color-accent-danger)",  ring: "rgba(255,97,102,0.30)",  label: "Rejected",  Icon: ShieldCheck },
};

function ProofBadgeImpl({
  hash, txSig, variant = "verified", href, compact, className,
}: ProofBadgeProps): JSX.Element {
  const t = TONE[variant];
  const target = href ?? `/proofs/${hash}`;

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-sm)] border",
        compact ? "px-2 py-0.5" : "px-2.5 py-1",
        "transition-[border-color,box-shadow,background] duration-[var(--duration-quick)] ease-[var(--ease-glide)]",
        "hover:bg-[color:var(--color-surface-raised)]",
        className,
      )}
      style={{ borderColor: t.ring }}
    >
      <span className="inline-flex items-center gap-1 font-mono" style={{ color: t.fg }}>
        <t.Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-[0.08em]">{t.label}</span>
      </span>
      <Identifier value={hash} />
      {txSig && <Identifier value={txSig} />}
    </span>
  );

  if (compact) return inner;
  return (
    <a href={target} className="inline-flex" aria-label={`Open proof ${hash}`}>
      {inner}
    </a>
  );
}

export const ProofBadge = memo(ProofBadgeImpl);
ProofBadge.displayName = "ProofBadge";

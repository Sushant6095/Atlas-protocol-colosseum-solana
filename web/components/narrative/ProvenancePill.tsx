// ProvenancePill — every cell in /intelligence and /market that
// renders a number SHOULD render this pill alongside (Phase 11 §0).
// Source = "warehouse" (proof-anchored) or "dune" (snapshot-tagged).

"use client";

import { memo } from "react";
import { cn } from "@/components/primitives";

export type ProvenanceKind = "warehouse" | "dune" | "rpc-fast" | "synth";

interface ProvenancePillProps {
  kind: ProvenanceKind;
  detail?: string;
  className?: string;
}

const KIND_CLASS: Record<ProvenanceKind, string> = {
  warehouse:  "bg-[color:var(--color-accent-execute)]/15 text-[color:var(--color-accent-execute)]",
  "rpc-fast": "bg-[color:var(--color-accent-electric)]/15 text-[color:var(--color-accent-electric)]",
  dune:       "bg-[color:var(--color-accent-zk)]/15 text-[color:var(--color-accent-zk)]",
  synth:      "bg-[color:var(--color-line-medium)] text-[color:var(--color-ink-tertiary)]",
};

const KIND_LABEL: Record<ProvenanceKind, string> = {
  warehouse:  "atlas warehouse",
  "rpc-fast": "rpc fast",
  dune:       "dune snapshot",
  synth:      "synthetic",
};

function ProvenancePillImpl({ kind, detail, className }: ProvenancePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-1.5 py-0.5",
        "font-mono text-[9px] uppercase tracking-[0.08em]",
        KIND_CLASS[kind],
        className,
      )}
      title={detail ?? KIND_LABEL[kind]}
    >
      {KIND_LABEL[kind]}
      {detail ? <span className="opacity-70 normal-case tracking-tight">· {detail}</span> : null}
    </span>
  );
}

export const ProvenancePill = memo(ProvenancePillImpl);
ProvenancePill.displayName = "ProvenancePill";

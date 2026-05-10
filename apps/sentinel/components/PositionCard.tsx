"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { KaminoPositionMock } from "@/lib/mocks/positions";

interface PositionCardProps {
  position: KaminoPositionMock;
  reconnecting?: boolean;
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function relTime(min: number): string {
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PositionCard({ position, reconnecting }: PositionCardProps) {
  const [open, setOpen] = useState(false);
  const pnl = position.currentUsd - position.principalUsd;
  const pnlPct = (pnl / position.principalUsd) * 100;
  const positive = pnl >= 0;

  return (
    <article
      className="rounded-xl border p-5 transition-colors"
      style={{
        borderColor: "var(--color-line-medium)",
        background: "var(--color-surface-raised)",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-base">{position.vaultName}</h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-tertiary)" }}>
            {position.strategyLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {reconnecting && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
              style={{
                borderColor: "color-mix(in oklab, var(--color-accent-warn) 30%, transparent)",
                color: "var(--color-accent-warn)",
                background: "color-mix(in oklab, var(--color-accent-warn) 8%, transparent)",
              }}
            >
              Reconnecting…
            </span>
          )}
          {position.rebalanceRecommended && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
              style={{
                background: "color-mix(in oklab, var(--color-accent-execute) 14%, transparent)",
                color: "var(--color-accent-execute)",
                border: "1px solid color-mix(in oklab, var(--color-accent-execute) 30%, transparent)",
              }}
            >
              <Sparkles className="h-3 w-3" /> Rebalance Recommended
            </span>
          )}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Principal" value={fmtUsd(position.principalUsd)} />
        <Stat label="Current"   value={fmtUsd(position.currentUsd)} valueColor={positive ? "var(--color-accent-execute)" : "var(--color-accent-danger)"} />
        <Stat label="APY"       value={`${position.apyPct.toFixed(2)}%`} valueColor={position.brandColor} />
        <Stat
          label="PnL"
          value={`${positive ? "+" : "−"}${fmtUsd(Math.abs(pnl))} (${positive ? "+" : "−"}${Math.abs(pnlPct).toFixed(2)}%)`}
          valueColor={positive ? "var(--color-accent-execute)" : "var(--color-accent-danger)"}
        />
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--color-ink-tertiary)" }}>
          Last rebalance · {relTime(position.lastRebalanceMinutesAgo)}
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:opacity-90"
          style={{
            borderColor: "var(--color-line-medium)",
            background: "var(--color-surface-base)",
            color: "var(--color-ink-primary)",
          }}
        >
          Hedge
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </footer>

      {open && (
        <div
          className="mt-3 rounded-md border p-3 text-xs"
          style={{
            borderColor: "var(--color-line-soft)",
            background: "var(--color-surface-base)",
            color: "var(--color-ink-secondary)",
          }}
        >
          DFlow quote integration ships in Phase 2. The button will route
          a swap via DFlow's best path, open the Solflare signing modal,
          and submit through Quicknode.
        </div>
      )}
    </article>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--color-ink-tertiary)" }}>
        {label}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums" style={{ color: valueColor ?? "var(--color-ink-primary)" }}>
        {value}
      </p>
    </div>
  );
}

// DecisionList — Decision Observatory list view (Phase 22 §7.1).

"use client";

import { memo, useState } from "react";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { RegimeBadge, type Regime } from "@/components/narrative";
import { cn } from "@/components/primitives";

interface DecisionRow {
  vault_id: string;
  slot: number;
  public_input_hash: string;
  regime: Regime;
  defensive_mode: boolean;
  hard_veto: boolean;
  alloc_diff_bps: number;
  agent_disagreement_bps: number;
}

const SAMPLES: DecisionRow[] = Array.from({ length: 16 }).map((_, i) => {
  const regimes: Regime[] = ["risk_on", "neutral", "neutral", "defensive", "neutral", "crisis", "risk_on", "neutral"];
  const regime = regimes[i % regimes.length];
  return {
    vault_id: ["ab12cdef", "01a02b03", "ff10ee20", "deadbeef"][i % 4] + "0".repeat(56),
    slot: 245_000_000 + i * 480,
    public_input_hash: ["a1b2c3d4", "e5f60718", "9081a2b3"][i % 3] + i.toString(16).padStart(56, "0"),
    regime,
    defensive_mode: regime === "defensive" || regime === "crisis",
    hard_veto: regime === "crisis",
    alloc_diff_bps: 600 + (i % 8) * 220,
    agent_disagreement_bps: 800 + (i % 5) * 350,
  };
});

const FILTERS: { id: "all" | Regime | "defensive" | "veto"; label: string }[] = [
  { id: "all",       label: "all" },
  { id: "risk_on",   label: "risk-on" },
  { id: "neutral",   label: "neutral" },
  { id: "defensive", label: "defensive" },
  { id: "crisis",    label: "crisis" },
  { id: "veto",      label: "agent veto" },
];

function DecisionListImpl() {
  const [filter, setFilter] = useState<typeof FILTERS[number]["id"]>("all");
  const filtered = SAMPLES.filter((row) => {
    if (filter === "all")       return true;
    if (filter === "veto")      return row.hard_veto;
    if (filter === "defensive") return row.defensive_mode;
    return row.regime === filter;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-[var(--radius-sm)] text-[12px]",
              "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-precise)]",
              filter === f.id
                ? "bg-[color:var(--color-accent-electric)]/15 text-[color:var(--color-accent-electric)] border border-[color:var(--color-accent-electric)]/40"
                : "border border-[color:var(--color-line-medium)] text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-line-soft)]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel surface="raised" density="dense">
        <table className="w-full text-[12px] font-mono">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-2 pr-2">slot</th>
              <th className="py-2 pr-2">vault</th>
              <th className="py-2 pr-2">regime</th>
              <th className="py-2 pr-2">alloc Δ</th>
              <th className="py-2 pr-2">disagreement</th>
              <th className="py-2 pr-2">flags</th>
              <th className="py-2 text-right">explanation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.public_input_hash}
                className="border-t border-[color:var(--color-line-soft)] hover:bg-[color:var(--color-line-soft)] cursor-pointer"
              >
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.slot.toLocaleString()}</td>
                <td className="py-1.5 pr-2"><IdentifierMono value={r.vault_id} size="xs" /></td>
                <td className="py-1.5 pr-2"><RegimeBadge regime={r.regime} /></td>
                <td className="py-1.5 pr-2">{(r.alloc_diff_bps / 100).toFixed(1)}%</td>
                <td className="py-1.5 pr-2">{(r.agent_disagreement_bps / 100).toFixed(1)}%</td>
                <td className="py-1.5 pr-2 space-x-1">
                  {r.defensive_mode ? <AlertPill severity="warn">defensive</AlertPill> : null}
                  {r.hard_veto ? <AlertPill severity="danger">veto</AlertPill> : null}
                </td>
                <td className="py-1.5 text-right">
                  <IdentifierMono value={r.public_input_hash} size="xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export const DecisionList = memo(DecisionListImpl);
DecisionList.displayName = "DecisionList";

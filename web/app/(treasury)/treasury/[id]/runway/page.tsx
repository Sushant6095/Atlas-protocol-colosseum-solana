// /treasury/[id]/runway — Runway forecast (Phase 23 §8.5).

"use client";

import { use, useState } from "react";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { ProvenancePill } from "@/components/narrative";

const DRIVERS = [
  { id: "dodo_payroll",   label: "Dodo payroll commit · next 30d",       impact_days: -32, source: "warehouse" as const, detail: "Phase 13 schedule (signed)" },
  { id: "kamino_decay",   label: "Kamino USDC APY decay (14d)",         impact_days:  -3, source: "warehouse" as const, detail: "atlas-warehouse · 14d window" },
  { id: "invoice_pull",   label: "ACME GmbH invoice (p50 settle 6d)",   impact_days:  +2, source: "warehouse" as const, detail: "atlas-payments invoice intelligence" },
  { id: "regime_buffer",  label: "Regime classifier flip · idle widen", impact_days:  -8, source: "warehouse" as const, detail: "atlas-pipeline regime classifier" },
  { id: "dune_inflows",   label: "DAO grant inflow estimate (cohort)",  impact_days: +18, source: "dune"      as const, detail: "dune exec_id 0x9a3b · 30d cohort fit" },
];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [extraPayout, setExtraPayout] = useState(0);
  const [accelerate,  setAccelerate]  = useState(0);

  const p10 = Math.max(0, 142 - Math.floor(extraPayout / 1000) + accelerate);
  const p50 = Math.max(0, 186 - Math.floor(extraPayout / 1000) + accelerate);

  return (
    <div className="px-4 py-4 space-y-3">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          runway forecast · phase 13
        </p>
        <div className="flex items-center gap-2 mt-1">
          <h1 className="text-display text-[20px]">Runway</h1>
          <IdentifierMono value={id} size="sm" />
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-4">
          <header className="mb-3"><Title>summary</Title></header>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="runway p10" value={`${p10}d`} accent={p10 < 30 ? "danger" : p10 < 60 ? "warn" : "execute"} mono />
            <Tile label="runway p50" value={`${p50}d`} mono />
            <Tile label="confidence" value="84%" mono />
            <Tile label="updated"    value="−2m" mono />
          </div>
          {p10 < 60 ? (
            <p className="mt-3 text-[12px] text-[color:var(--color-ink-secondary)]">
              <AlertPill severity={p10 < 30 ? "danger" : "warn"}>policy alert</AlertPill>
              <span className="ml-2">Allocation tightened due to runway p10 = {p10}d &lt; 60d threshold.</span>
            </p>
          ) : null}
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-8">
          <header className="mb-3"><Title>balance projection · 90d · p10–p90 fan</Title></header>
          <RunwayChart p10Days={p10} p50Days={p50} />
        </Panel>
      </div>

      <Panel surface="raised" density="dense">
        <header className="mb-3"><Title>drivers · what shifted the forecast</Title></header>
        <ul className="space-y-2">
          {DRIVERS.map((d) => (
            <li key={d.id} className="grid grid-cols-12 gap-3 items-center font-mono text-[11px]">
              <span className="col-span-3 text-[color:var(--color-ink-tertiary)]">{d.id}</span>
              <span className="col-span-5 text-[color:var(--color-ink-primary)]">{d.label}</span>
              <span className="col-span-1 text-right">
                <ProvenancePill kind={d.source} detail={d.detail} />
              </span>
              <div className="col-span-2">
                <div className="h-1.5 rounded-[var(--radius-xs)] bg-[color:var(--color-line-medium)] overflow-hidden">
                  <div className={`h-full ${d.impact_days >= 0 ? "bg-[color:var(--color-accent-execute)]" : "bg-[color:var(--color-accent-danger)]"}`}
                       style={{ width: `${Math.min(100, Math.abs(d.impact_days) * 3)}%` }} />
                </div>
              </div>
              <span className={`col-span-1 text-right ${d.impact_days >= 0 ? "text-[color:var(--color-accent-execute)]" : "text-[color:var(--color-accent-danger)]"}`}>
                {d.impact_days >= 0 ? "+" : ""}{d.impact_days}d
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel surface="raised" density="dense">
        <header className="mb-3"><Title>what if · simulate</Title></header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">add payout (USD)</span>
            <input type="range" min={0} max={500_000} step={5_000}
                   value={extraPayout} onChange={(e) => setExtraPayout(Number(e.target.value))}
                   className="accent-[color:var(--color-accent-electric)]" />
            <span className="font-mono text-[12px]">${extraPayout.toLocaleString()}</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">accelerate invoice (days)</span>
            <input type="range" min={0} max={30} step={1}
                   value={accelerate} onChange={(e) => setAccelerate(Number(e.target.value))}
                   className="accent-[color:var(--color-accent-execute)]" />
            <span className="font-mono text-[12px]">+{accelerate}d</span>
          </label>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => { setExtraPayout(0); setAccelerate(0); }}>reset</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{children}</span>;
}

function RunwayChart({ p10Days, p50Days }: { p10Days: number; p50Days: number }) {
  // Composite p10/p50/p90 lines on a 90-day projection.
  const days = Array.from({ length: 91 }, (_, i) => i);
  const start = 8.34;
  const seriesP10 = days.map((d) => Math.max(0, start * (1 - d / Math.max(1, p10Days))));
  const seriesP50 = days.map((d) => Math.max(0, start * (1 - d / Math.max(1, p50Days))));
  const seriesP90 = days.map((d) => Math.max(0, start * (1 - d / Math.max(1, p50Days * 1.4))));

  const W = 800, H = 220;
  const x = (i: number) => (i / (days.length - 1)) * W;
  const max = Math.max(...seriesP90);
  const y = (v: number) => H - (v / max) * (H - 20) - 10;

  const path = (s: number[]) => s.map((v, i) => (i === 0 ? `M ${x(i)} ${y(v)}` : `L ${x(i)} ${y(v)}`)).join(" ");
  const fan = `${path(seriesP10)} L ${x(seriesP90.length - 1)} ${y(seriesP90[seriesP90.length - 1])} ${seriesP90.slice().reverse().map((v, i) => `L ${x(seriesP90.length - 1 - i)} ${y(v)}`).join(" ")} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px] block">
      <path d={fan}      fill="rgba(63,140,255,0.10)" stroke="none" />
      <path d={path(seriesP90)} stroke="rgba(63,140,255,0.40)" strokeWidth={1.0} fill="none" />
      <path d={path(seriesP50)} stroke="#3F8CFF"             strokeWidth={1.4} fill="none" />
      <path d={path(seriesP10)} stroke="#FF6166"             strokeWidth={1.4} fill="none" />
    </svg>
  );
}

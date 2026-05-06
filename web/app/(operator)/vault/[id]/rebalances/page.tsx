// /vault/[id]/rebalances — virtualized rebalance list (Phase 23 §3.1).

"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { RegimeBadge, type Regime } from "@/components/narrative";
import { cn } from "@/components/primitives";

interface Row {
  slot: number;
  age_s: number;
  hash: string;
  regime: Regime;
  defensive: boolean;
  diff_bps: number;
  e2e_ms: number;
  verifier_cu: number;
  route: "Jito" | "SWQoS" | "DFlow";
  status: "landed" | "aborted" | "rejected";
}

const ROUTES: Row["route"][] = ["Jito", "SWQoS", "DFlow"];
const REGIMES: Regime[] = ["risk_on", "neutral", "neutral", "defensive", "neutral", "crisis", "risk_on"];

function makeRows(n: number): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < n; i++) {
    const regime = REGIMES[i % REGIMES.length];
    out.push({
      slot: 245_000_000 + i * 480,
      age_s: 12 + i * 480,
      hash: ["a1b2c3d4", "e5f60718", "9081a2b3", "c2d3e4f5"][i % 4] + i.toString(16).padStart(56, "0"),
      regime,
      defensive: regime === "defensive" || regime === "crisis",
      diff_bps: 600 + (i % 9) * 220,
      e2e_ms: 28_000 + (i % 7) * 4_000,
      verifier_cu: 220_000 + (i % 5) * 9_000,
      route: ROUTES[i % 3],
      status: i % 11 === 10 ? "rejected" : i % 13 === 12 ? "aborted" : "landed",
    });
  }
  return out;
}

const ALL_ROWS = makeRows(120);

type RegimeFilter = "all" | Regime;
type RouteFilter  = "all" | Row["route"];
type StatusFilter = "all" | Row["status"];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [regime, setRegime] = useState<RegimeFilter>("all");
  const [route,  setRoute]  = useState<RouteFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [defOnly, setDefOnly] = useState(false);

  const rows = useMemo(() => {
    return ALL_ROWS.filter((r) => {
      if (regime !== "all" && r.regime !== regime) return false;
      if (route  !== "all" && r.route  !== route)  return false;
      if (status !== "all" && r.status !== status) return false;
      if (defOnly && !r.defensive) return false;
      return true;
    });
  }, [regime, route, status, defOnly]);

  return (
    <div className="space-y-3 px-4 py-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            rebalances · vault
          </p>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-display text-[20px]">Rebalance history</h1>
            <IdentifierMono value={id} size="sm" />
          </div>
        </div>
        <div className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
          [/]&nbsp;step · enter open · {rows.length} rows
        </div>
      </header>

      <Panel surface="raised" density="dense">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <FilterChip label="regime" value={regime} onChange={(v) => setRegime(v as RegimeFilter)}
                      options={["all", "risk_on", "neutral", "defensive", "crisis"]} />
          <FilterChip label="route"  value={route}  onChange={(v) => setRoute(v as RouteFilter)}
                      options={["all", "Jito", "SWQoS", "DFlow"]} />
          <FilterChip label="status" value={status} onChange={(v) => setStatus(v as StatusFilter)}
                      options={["all", "landed", "aborted", "rejected"]} />
          <label className="ml-2 inline-flex items-center gap-2 text-[12px] cursor-pointer">
            <input type="checkbox" checked={defOnly} onChange={(e) => setDefOnly(e.target.checked)}
                   className="accent-[color:var(--color-accent-warn)]" />
            <span className="text-[color:var(--color-ink-secondary)]">defensive only</span>
          </label>
        </div>

        <div className="max-h-[60vh] overflow-auto scroll-area font-mono text-[11px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-[color:var(--color-surface-raised)]">
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="py-2 pr-2">slot</th>
                <th className="py-2 pr-2">age</th>
                <th className="py-2 pr-2">hash</th>
                <th className="py-2 pr-2">regime</th>
                <th className="py-2 pr-2 text-right">diff</th>
                <th className="py-2 pr-2 text-right">e2e</th>
                <th className="py-2 pr-2 text-right">cu</th>
                <th className="py-2 pr-2">route</th>
                <th className="py-2 pr-2">status</th>
                <th className="py-2 pr-2">flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.hash} className="border-t border-[color:var(--color-line-soft)] hover:bg-[color:var(--color-line-soft)]">
                  <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.slot.toLocaleString()}</td>
                  <td className="py-1.5 pr-2 text-[color:var(--color-ink-tertiary)]">{fmtAge(r.age_s)}</td>
                  <td className="py-1.5 pr-2">
                    <Link href={`/vault/${id}/rebalances/${r.hash}`} className="hover:underline">
                      <IdentifierMono value={r.hash} size="xs" />
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2"><RegimeBadge regime={r.regime} /></td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{(r.diff_bps / 100).toFixed(1)}%</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{(r.e2e_ms / 1_000).toFixed(1)}s</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{(r.verifier_cu / 1_000).toFixed(0)}k</td>
                  <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.route}</td>
                  <td className="py-1.5 pr-2">
                    {r.status === "landed"   ? <AlertPill severity="execute">landed</AlertPill>
                   : r.status === "aborted"  ? <AlertPill severity="warn">aborted</AlertPill>
                   :                           <AlertPill severity="danger">rejected</AlertPill>}
                  </td>
                  <td className="py-1.5 pr-2">{r.defensive ? <AlertPill severity="warn">defensive</AlertPill> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FilterChip({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{label}</span>
      <div className="flex border border-[color:var(--color-line-medium)] rounded-[var(--radius-sm)] overflow-hidden">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "px-2 h-6 text-[11px] font-mono",
              o === value
                ? "bg-[color:var(--color-line-soft)] text-[color:var(--color-ink-primary)]"
                : "text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-line-soft)]",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </span>
  );
}

function fmtAge(s: number): string {
  if (s < 90) return `${s}s`;
  if (s < 60 * 60) return `${Math.floor(s / 60)}m`;
  if (s < 24 * 60 * 60) return `${Math.floor(s / 3_600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

// /risk — Cross-protocol risk dashboard (Phase 22 §11).

"use client";

import { useState } from "react";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { AlertPill } from "@/components/primitives/AlertPill";
import { ProvenancePill } from "@/components/narrative";

const ORACLE = [
  { feed: "kSOL/USD", pyth_bps: 12, switchboard_bps: 18, twap_bps: 14 },
  { feed: "SOL/USD",  pyth_bps: 6,  switchboard_bps: 9,  twap_bps: 7  },
  { feed: "JLP/USD",  pyth_bps: 24, switchboard_bps: 31, twap_bps: 22 },
];

const VOL_SURFACE = [
  { asset: "SOL",  parkinson: 0.74, garch: 0.62 },
  { asset: "kSOL", parkinson: 0.81, garch: 0.69 },
  { asset: "JLP",  parkinson: 0.95, garch: 0.83 },
  { asset: "USDC", parkinson: 0.04, garch: 0.03 },
];

const RADAR = [
  { axis: "tail",          value: 0.62 },
  { axis: "liquidity",     value: 0.18 },
  { axis: "oracle",        value: 0.24 },
  { axis: "concentration", value: 0.31 },
  { axis: "leverage",      value: 0.40 },
  { axis: "drawdown",      value: 0.27 },
];

export default function Page() {
  const [shock, setShock] = useState(15);
  const [asset, setAsset] = useState("kSOL");

  // Synthetic cascade — Phase 23 wires this against the warehouse replay.
  const cascade = computeCascade(asset, shock);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          institutional risk dashboard · 24h
        </p>
        <h1 className="text-display text-[28px] mt-2">Cross-protocol risk</h1>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          <header className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              risk topology · shared collateral / oracle / liquidator dependencies
            </p>
            <ProvenancePill kind="warehouse" detail="atlas-exposure + ovl" />
          </header>
          <RiskTopology />
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              vault risk radar · 6 axes
            </p>
          </header>
          <RiskRadar values={RADAR} />
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-7">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              liquidity-collapse simulator
            </p>
          </header>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2">
              <span className="text-[11px] text-[color:var(--color-ink-tertiary)]">asset</span>
              <select
                value={asset} onChange={(e) => setAsset(e.target.value)}
                className="bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] rounded-[var(--radius-xs)] text-[12px] font-mono px-2 py-1"
              >
                {VOL_SURFACE.map((r) => <option key={r.asset}>{r.asset}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 flex-1">
              <span className="text-[11px] text-[color:var(--color-ink-tertiary)]">shock −{shock}%</span>
              <input
                type="range" min={5} max={50} value={shock}
                onChange={(e) => setShock(Number(e.target.value))}
                className="flex-1 accent-[color:var(--color-accent-zk)]"
              />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Tile label="liquidations triggered" value={cascade.liquidations} mono />
            <Tile label="atlas projected loss"
                  value={`${(cascade.lossPct * 100).toFixed(1)}%`}
                  accent={cascade.lossPct > 0.05 ? "danger" : "warn"} mono />
            <Tile label="recovery slots"        value={cascade.recoverySlots} mono />
          </div>
          <p className="mt-3 text-[11px] text-[color:var(--color-ink-tertiary)]">
            replayed against the warehouse · Phase 23 wires the live counterfactual.
          </p>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-5">
          <header className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              oracle deviation · pyth / switchboard / twap (bps)
            </p>
            <ProvenancePill kind="warehouse" />
          </header>
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="text-left py-1">feed</th>
                <th className="text-right py-1">pyth</th>
                <th className="text-right py-1">switchboard</th>
                <th className="text-right py-1">twap</th>
                <th className="text-right py-1">max</th>
              </tr>
            </thead>
            <tbody>
              {ORACLE.map((r) => {
                const max = Math.max(r.pyth_bps, r.switchboard_bps, r.twap_bps);
                return (
                  <tr key={r.feed} className="border-t border-[color:var(--color-line-soft)]">
                    <td className="py-1.5">{r.feed}</td>
                    <td className="py-1.5 text-right">{r.pyth_bps}</td>
                    <td className="py-1.5 text-right">{r.switchboard_bps}</td>
                    <td className="py-1.5 text-right">{r.twap_bps}</td>
                    <td className="py-1.5 text-right">
                      <AlertPill severity={max > 20 ? "warn" : "ok"}>{max} bps</AlertPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              volatility surface · parkinson + garch
            </p>
          </header>
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="text-left py-1">asset</th>
                <th className="text-right py-1">parkinson 30d</th>
                <th className="text-right py-1">garch 30d</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {VOL_SURFACE.map((r) => (
                <tr key={r.asset} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5">{r.asset}</td>
                  <td className="py-1.5 text-right">{r.parkinson.toFixed(2)}</td>
                  <td className="py-1.5 text-right">{r.garch.toFixed(2)}</td>
                  <td className="py-1.5">
                    <div className="h-1.5 rounded-[var(--radius-xs)] overflow-hidden bg-[color:var(--color-line-medium)]">
                      <div
                        className="h-full bg-[color:var(--color-accent-zk)]"
                        style={{ width: `${Math.min(100, r.garch * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function computeCascade(asset: string, shockPct: number) {
  const seed = [...asset].reduce((a, c) => a + c.charCodeAt(0), 0);
  const liquidations = Math.round(shockPct * 1.4 + (seed % 7));
  const lossPct = Math.min(0.18, (shockPct / 100) * 0.42);
  const recoverySlots = 32 + shockPct * 5 + (seed % 12);
  return { liquidations, lossPct, recoverySlots };
}

function RiskTopology() {
  return (
    <svg viewBox="0 0 600 320" className="w-full h-[260px] block">
      {[
        { x: 100, y: 80,  l: "Kamino" },
        { x: 100, y: 220, l: "Drift" },
        { x: 300, y: 60,  l: "Pyth oracle" },
        { x: 300, y: 160, l: "USDC pool" },
        { x: 300, y: 260, l: "kSOL collateral" },
        { x: 500, y: 90,  l: "Marginfi" },
        { x: 500, y: 230, l: "Jupiter" },
      ].map((n) => (
        <g key={n.l} transform={`translate(${n.x}, ${n.y})`}>
          <circle r={20} fill="rgba(63,140,255,0.18)" stroke="rgba(255,255,255,0.16)" />
          <text textAnchor="middle" y={4} fontSize={10} className="font-mono" fill="#9AA3B5">{n.l}</text>
        </g>
      ))}
      {[
        ["Kamino", "USDC pool"], ["Kamino", "Pyth oracle"],
        ["Drift", "kSOL collateral"], ["Drift", "Pyth oracle"],
        ["Marginfi", "USDC pool"], ["Marginfi", "Pyth oracle"],
        ["Jupiter", "kSOL collateral"], ["Jupiter", "USDC pool"],
      ].map(([a, b]) => {
        const lookup = (l: string) => ({
          "Kamino": [100, 80], "Drift": [100, 220], "Pyth oracle": [300, 60],
          "USDC pool": [300, 160], "kSOL collateral": [300, 260],
          "Marginfi": [500, 90], "Jupiter": [500, 230],
        } as Record<string, [number, number]>)[l];
        const [ax, ay] = lookup(a); const [bx, by] = lookup(b);
        return (
          <line key={a + b} x1={ax} y1={ay} x2={bx} y2={by}
                stroke="rgba(166,130,255,0.45)" strokeWidth={1.2} />
        );
      })}
    </svg>
  );
}

function RiskRadar({ values }: { values: { axis: string; value: number }[] }) {
  const cx = 150, cy = 150, r = 120;
  const N = values.length;
  const points = values.map((v, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return [cx + Math.cos(a) * r * v.value, cy + Math.sin(a) * r * v.value];
  });
  const path = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ") + " Z";
  return (
    <svg viewBox="0 0 300 320" className="w-full h-[300px] block">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={values.map((_, i) => {
            const a = (i / N) * 2 * Math.PI - Math.PI / 2;
            return `${cx + Math.cos(a) * r * k},${cy + Math.sin(a) * r * k}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      <path d={path} fill="rgba(166,130,255,0.18)" stroke="#A682FF" strokeWidth={1.2} />
      {values.map((v, i) => {
        const a = (i / N) * 2 * Math.PI - Math.PI / 2;
        return (
          <text
            key={v.axis}
            x={cx + Math.cos(a) * (r + 18)}
            y={cy + Math.sin(a) * (r + 18) + 3}
            textAnchor="middle"
            fontSize={10}
            className="font-mono"
            fill="#9AA3B5"
          >
            {v.axis}
          </text>
        );
      })}
    </svg>
  );
}

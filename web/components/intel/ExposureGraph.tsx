// ExposureGraph — Wallet → Protocol → Asset (Phase 22 §9.2).
//
// Hand-laid-out SVG graph; nodes sized by notional, edges weighted by
// path-decayed effective exposure. Click any node to see its
// contributing positions (stub for now; Phase 23 wires the SDK).

"use client";

import { memo, useMemo, useState } from "react";
import { Panel } from "@/components/primitives/Panel";

interface GNode {
  id: string;
  label: string;
  kind: "wallet" | "protocol" | "asset";
  weight: number;
  x: number;
  y: number;
}

interface GEdge {
  from: string;
  to: string;
  weight: number;
}

const NODES: GNode[] = [
  { id: "w.0",  label: "wallet",     kind: "wallet",   weight: 1.0,  x: 80,  y: 320 },

  { id: "p.kamino",  label: "Kamino",   kind: "protocol", weight: 0.42, x: 380, y: 120 },
  { id: "p.drift",   label: "Drift",    kind: "protocol", weight: 0.31, x: 380, y: 250 },
  { id: "p.marginfi",label: "Marginfi", kind: "protocol", weight: 0.18, x: 380, y: 380 },
  { id: "p.jupiter", label: "Jupiter",  kind: "protocol", weight: 0.09, x: 380, y: 500 },

  { id: "a.usdc",  label: "USDC",  kind: "asset", weight: 0.55, x: 720, y: 90  },
  { id: "a.ksol",  label: "kSOL",  kind: "asset", weight: 0.18, x: 720, y: 200 },
  { id: "a.sol",   label: "SOL",   kind: "asset", weight: 0.14, x: 720, y: 310 },
  { id: "a.jlp",   label: "JLP",   kind: "asset", weight: 0.07, x: 720, y: 420 },
  { id: "a.usdt",  label: "USDT",  kind: "asset", weight: 0.06, x: 720, y: 530 },
];

const EDGES: GEdge[] = [
  { from: "w.0", to: "p.kamino",   weight: 0.42 },
  { from: "w.0", to: "p.drift",    weight: 0.31 },
  { from: "w.0", to: "p.marginfi", weight: 0.18 },
  { from: "w.0", to: "p.jupiter",  weight: 0.09 },

  { from: "p.kamino",   to: "a.usdc", weight: 0.30 },
  { from: "p.kamino",   to: "a.usdt", weight: 0.06 },
  { from: "p.kamino",   to: "a.sol",  weight: 0.06 },
  { from: "p.drift",    to: "a.ksol", weight: 0.18 },
  { from: "p.drift",    to: "a.sol",  weight: 0.08 },
  { from: "p.drift",    to: "a.usdc", weight: 0.05 },
  { from: "p.marginfi", to: "a.usdc", weight: 0.13 },
  { from: "p.marginfi", to: "a.sol",  weight: 0.05 },
  { from: "p.jupiter",  to: "a.jlp",  weight: 0.07 },
  { from: "p.jupiter",  to: "a.usdc", weight: 0.02 },
];

function ExposureGraphImpl() {
  const [active, setActive] = useState<string | null>(null);
  const focused = useMemo(() => NODES.find((n) => n.id === active) ?? null, [active]);
  return (
    <Panel surface="raised" density="default">
      <header className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          exposure graph · wallet → protocol → asset
        </p>
        <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
          path-decayed effective exposure
        </span>
      </header>
      <svg viewBox="0 0 820 600" className="w-full h-[520px] block">
        <defs>
          <linearGradient id="edge-grad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#3F8CFF" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#A682FF" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        {EDGES.map((e) => {
          const a = NODES.find((n) => n.id === e.from)!;
          const b = NODES.find((n) => n.id === e.to)!;
          const lit = active && (e.from === active || e.to === active);
          return (
            <line
              key={`${e.from}->${e.to}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={lit ? "#A682FF" : "url(#edge-grad)"}
              strokeWidth={Math.max(1, e.weight * 8)}
              strokeOpacity={lit ? 0.9 : 0.45}
            />
          );
        })}
        {NODES.map((n) => {
          const r = 8 + n.weight * 28;
          const isActive = n.id === active;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              onMouseEnter={() => setActive(n.id)}
              onMouseLeave={() => setActive((cur) => (cur === n.id ? null : cur))}
              style={{ cursor: "pointer" }}
            >
              <circle
                r={r}
                fill={NODE_FILL[n.kind]}
                stroke={isActive ? "#A682FF" : "rgba(255,255,255,0.16)"}
                strokeWidth={isActive ? 2 : 1}
              />
              <text
                y={r + 14}
                textAnchor="middle"
                fontSize={11}
                className="font-mono"
                fill={isActive ? "#E6EAF2" : "#9AA3B5"}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <footer className="min-h-[80px] mt-2 grid grid-cols-12 gap-3">
        <div className="col-span-9">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            counterfactual delta
          </p>
          {focused ? (
            <p className="text-[12px] text-[color:var(--color-ink-secondary)] mt-1">
              If <span className="font-mono text-[color:var(--color-ink-primary)]">{focused.label}</span> disappeared,
              path-decayed exposure changes by{" "}
              <span className="font-mono text-[color:var(--color-accent-warn)]">
                {(focused.weight * 100).toFixed(1)}%
              </span>.
            </p>
          ) : (
            <p className="text-[12px] text-[color:var(--color-ink-tertiary)] mt-1">
              hover a node to see its contribution.
            </p>
          )}
        </div>
        <div className="col-span-3 flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NODE_FILL.wallet }}/>wallet</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NODE_FILL.protocol }}/>protocol</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NODE_FILL.asset }}/>asset</span>
        </div>
      </footer>
    </Panel>
  );
}

const NODE_FILL = {
  wallet:   "rgba(63,140,255,0.20)",
  protocol: "rgba(166,130,255,0.20)",
  asset:    "rgba(60,227,154,0.20)",
} as const;

export const ExposureGraph = memo(ExposureGraphImpl);
ExposureGraph.displayName = "ExposureGraph";

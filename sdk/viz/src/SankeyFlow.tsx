// SankeyFlow — multi-stage capital flow (Phase 24 §1.2).
//
// Used by /market and /treasury/[id]/ledger. Hand-laid layout —
// nodes group into vertical columns (stages); edges weighted by
// flow. Canvas batching for ≥ 1000 nodes / 2000 edges; the SVG path
// here is the spec; the production canvas renderer ships in the
// host app per §1.1.
//
// Performance budget: ≤ 16ms frame at 1k nodes / 2k edges.

import { memo, useMemo } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { VIZ_PALETTE, vizColor, vizFont } from "./tokens.js";

export interface SankeyNode { id: string; label: string; column: number; }
export interface SankeyEdge { from: string; to: string; flow: number; }

export interface SankeyFlowProps extends AriaDescribed {
  nodes: SankeyNode[];
  edges: SankeyEdge[];
  width?: number;
  height?: number;
}

function SankeyFlowImpl({
  nodes, edges,
  width = 720, height = 320,
  description = "Sankey flow showing capital movement across stages.",
  dataTable,
}: SankeyFlowProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();

  const layout = useMemo(() => {
    const cols = new Map<number, SankeyNode[]>();
    for (const n of nodes) {
      if (!cols.has(n.column)) cols.set(n.column, []);
      cols.get(n.column)!.push(n);
    }
    const colCount = cols.size || 1;
    const dx = width / Math.max(1, colCount - 1);
    const positions = new Map<string, { x: number; y: number; height: number }>();
    for (const [c, ns] of cols) {
      const sumIn  = ns.map((n) => sum(edges.filter((e) => e.to === n.id).map((e) => e.flow)));
      const sumOut = ns.map((n) => sum(edges.filter((e) => e.from === n.id).map((e) => e.flow)));
      const totals = ns.map((_, i) => Math.max(sumIn[i], sumOut[i], 1));
      const grand = sum(totals);
      let y = 0;
      const rowGap = 6;
      const usable = height - rowGap * Math.max(0, ns.length - 1);
      for (let i = 0; i < ns.length; i++) {
        const h = (totals[i] / grand) * usable;
        positions.set(ns[i].id, { x: c * dx, y, height: h });
        y += h + rowGap;
      }
    }
    return positions;
  }, [nodes, edges, width, height]);

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sankey capital flow" className="block w-full h-auto">
        {/* Edges */}
        {edges.map((e, i) => {
          const a = layout.get(e.from);
          const b = layout.get(e.to);
          if (!a || !b) return null;
          const total = Math.max(1, sum(edges.filter((x) => x.from === e.from).map((x) => x.flow)));
          const stroke = (e.flow / total) * a.height;
          const x0 = a.x + 14;
          const x1 = b.x;
          const y0 = a.y + a.height / 2;
          const y1 = b.y + b.height / 2;
          const cx = (x0 + x1) / 2;
          return (
            <path
              key={i}
              d={`M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`}
              stroke={VIZ_PALETTE[i % VIZ_PALETTE.length]}
              strokeOpacity={0.35}
              strokeWidth={Math.max(1, stroke)}
              fill="none"
            />
          );
        })}
        {/* Nodes */}
        {nodes.map((n) => {
          const p = layout.get(n.id);
          if (!p) return null;
          return (
            <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
              <rect width={14} height={p.height} fill={vizColor.electric} rx={2} />
              <text x={20} y={Math.min(p.height / 2 + 4, 10)} fontSize={10} fontFamily={vizFont.mono} fill={vizColor.ink2}>
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <button type="button" onClick={toggleTable} aria-expanded={showTable}
              style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
              className="mt-2 underline-offset-2 hover:underline">
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Sankey data table" className="mt-2">
          {dataTable ?? <DefaultTable nodes={nodes} edges={edges} />}
        </div>
      ) : null}
    </figure>
  );
}

function DefaultTable({ nodes, edges }: { nodes: SankeyNode[]; edges: SankeyEdge[] }) {
  return (
    <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
      <thead><tr><th align="left">from</th><th align="left">to</th><th align="right">flow</th></tr></thead>
      <tbody>
        {edges.map((e, i) => {
          const f = nodes.find((n) => n.id === e.from)?.label ?? e.from;
          const t = nodes.find((n) => n.id === e.to)?.label ?? e.to;
          return <tr key={i}><td>{f}</td><td>{t}</td><td align="right">{e.flow}</td></tr>;
        })}
      </tbody>
    </table>
  );
}

function sum(xs: number[]): number { return xs.reduce((a, b) => a + b, 0); }

export const SankeyFlow = memo(SankeyFlowImpl);
SankeyFlow.displayName = "SankeyFlow";

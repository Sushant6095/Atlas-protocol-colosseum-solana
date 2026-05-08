// DependencyGraph — force-directed graph (Phase 24 §1.2).
//
// Used by /architecture, /risk (cross-protocol topology),
// /intelligence (exposure graph). Production renderer ships in the
// host app via WebGL with instanced nodes + line shader. The
// component below ships the deterministic SVG fallback used when
// WebGL is unavailable or `prefers-reduced-motion` is set.
//
// Performance budget: 60fps at 5_000 nodes / 10_000 edges (WebGL
// path); SVG fallback caps at 300 nodes for layout-stable
// rendering.

import { memo, useMemo, useState } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor, vizFont } from "./tokens.js";

export interface GraphNode {
  id: string;
  label: string;
  weight?: number;        // 0..=1 — drives node size
  group?: string;         // categorical bucket
  /** Pre-computed layout position; if absent, the host runs force-direct. */
  x?: number;
  y?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight?: number;        // 0..=1
}

export interface DependencyGraphProps extends AriaDescribed {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  /** Disable the SVG fallback when host renders the WebGL canvas. */
  renderSvg?: boolean;
  onSelect?: (node: GraphNode) => void;
}

function DependencyGraphImpl({
  nodes, edges,
  width = 720, height = 480,
  renderSvg = true,
  onSelect,
  description = "Force-directed dependency graph.",
  dataTable,
}: DependencyGraphProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();
  const [active, setActive] = useState<string | null>(null);

  // Position fallback — radial layout when no x/y given. Host should
  // pass pre-laid positions for ≥ 300 nodes.
  const positioned = useMemo(() => {
    return nodes.map((n, i) => {
      if (n.x != null && n.y != null) return n;
      const a = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
      const r = Math.min(width, height) * 0.4;
      return { ...n, x: width / 2 + Math.cos(a) * r, y: height / 2 + Math.sin(a) * r };
    });
  }, [nodes, width, height]);
  const positionedById = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      {renderSvg ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dependency graph" className="block w-full h-auto">
          {edges.map((e, i) => {
            const a = positionedById.get(e.from);
            const b = positionedById.get(e.to);
            if (!a || !b) return null;
            const lit = active === e.from || active === e.to;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={lit ? vizColor.zk : vizColor.line2}
                strokeOpacity={lit ? 0.9 : 0.45}
                strokeWidth={Math.max(0.6, (e.weight ?? 0.4) * 4)}
              />
            );
          })}
          {positioned.map((n) => {
            const r = 4 + (n.weight ?? 0.3) * 18;
            const isActive = active === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive((cur) => (cur === n.id ? null : cur))}
                onClick={() => onSelect?.(n)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  r={r}
                  fill={vizColor.electric}
                  fillOpacity={0.18}
                  stroke={isActive ? vizColor.zk : vizColor.line2}
                  strokeWidth={isActive ? 1.5 : 1}
                />
                <text y={r + 12} textAnchor="middle" fontSize={10} fontFamily={vizFont.mono}
                      fill={isActive ? vizColor.ink : vizColor.ink2}>
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}
      <button type="button" onClick={toggleTable} aria-expanded={showTable}
              style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
              className="mt-2 underline-offset-2 hover:underline">
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Graph data table" className="mt-2">
          {dataTable ?? (
            <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
              <thead><tr><th align="left">id</th><th align="left">label</th><th align="right">weight</th></tr></thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.id}><td>{n.id}</td><td>{n.label}</td><td align="right">{(n.weight ?? 0).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </figure>
  );
}

export const DependencyGraph = memo(DependencyGraphImpl);
DependencyGraph.displayName = "DependencyGraph";

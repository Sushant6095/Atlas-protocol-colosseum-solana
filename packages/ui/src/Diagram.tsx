// <Diagram> — pure-SVG flow diagram for Atlas's "five layers"
// architecture and similar small DAGs. Avoids pulling Mermaid at
// runtime (~600 KB) for the handful of static diagrams shipped in
// the docs site. Consumers describe nodes + edges; the layout uses
// a left-to-right tier model.
//
// For ad-hoc diagrams in MDX, the host can still reach for Mermaid
// directly — this primitive is the curated path.

"use client";

import { memo, useMemo } from "react";
import { cn } from "./cn";

export type NodeTone = "neutral" | "electric" | "zk" | "execute" | "warn" | "proof";

export interface DiagramNode {
  id: string;
  label: string;
  tier: number;
  tone?: NodeTone;
  sub?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  width?: number;
  height?: number;
  className?: string;
}

const TONE: Record<NodeTone, string> = {
  neutral:  "var(--color-ink-secondary)",
  electric: "var(--color-accent-electric)",
  zk:       "var(--color-accent-zk)",
  execute:  "var(--color-accent-execute)",
  warn:     "var(--color-accent-warn)",
  proof:    "var(--color-accent-proof)",
};

interface Layout {
  positions: Record<string, { x: number; y: number; w: number; h: number }>;
  width: number;
  height: number;
}

function layout(nodes: DiagramNode[], width: number, height: number): Layout {
  const tiers: DiagramNode[][] = [];
  for (const n of nodes) {
    (tiers[n.tier] ??= []).push(n);
  }
  const tierCount = tiers.length;
  const colGap = width / (tierCount + 1);
  const nodeW = Math.min(180, colGap * 0.85);
  const nodeH = 56;
  const positions: Layout["positions"] = {};
  tiers.forEach((tier, ti) => {
    const x = colGap * (ti + 1);
    const rowGap = height / (tier.length + 1);
    tier.forEach((n, ri) => {
      positions[n.id] = {
        x: x - nodeW / 2,
        y: rowGap * (ri + 1) - nodeH / 2,
        w: nodeW,
        h: nodeH,
      };
    });
  });
  return { positions, width, height };
}

function DiagramImpl({
  nodes, edges, width = 720, height = 320, className,
}: DiagramProps): JSX.Element {
  const lay = useMemo(() => layout(nodes, width, height), [nodes, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full h-auto", className)}
      role="img"
      aria-label="Atlas architecture diagram"
    >
      <defs>
        <marker
          id="atlas-diag-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-line-strong)" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = lay.positions[e.from];
        const b = lay.positions[e.to];
        if (!a || !b) return null;
        const x1 = a.x + a.w;
        const y1 = a.y + a.h / 2;
        const x2 = b.x;
        const y2 = b.y + b.h / 2;
        const cx = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
        return (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke="var(--color-line-medium)"
              strokeWidth={1.4}
              markerEnd="url(#atlas-diag-arrow)"
            />
            {e.label && (
              <text
                x={cx}
                y={(y1 + y2) / 2 - 6}
                textAnchor="middle"
                style={{ fill: "var(--color-ink-tertiary)", font: "10px var(--font-mono)" }}
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const p = lay.positions[n.id];
        const tone = TONE[n.tone ?? "neutral"];
        return (
          <g key={n.id}>
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx={10}
              fill="var(--color-surface-raised)"
              stroke={tone}
              strokeOpacity={0.55}
              strokeWidth={1.2}
            />
            <text
              x={p.x + p.w / 2}
              y={p.y + (n.sub ? p.h / 2 - 2 : p.h / 2 + 4)}
              textAnchor="middle"
              style={{ fill: "var(--color-ink-primary)", font: "600 12px var(--font-display)" }}
            >
              {n.label}
            </text>
            {n.sub && (
              <text
                x={p.x + p.w / 2}
                y={p.y + p.h / 2 + 14}
                textAnchor="middle"
                style={{ fill: "var(--color-ink-tertiary)", font: "10px var(--font-mono)" }}
              >
                {n.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const Diagram = memo(DiagramImpl);

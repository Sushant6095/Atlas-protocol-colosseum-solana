// RadialLiquidityMap — concentric protocol rings (Phase 24 §1.2).
//
// Used by /intelligence and /risk. Concentric rings = protocols;
// arc lengths = effective exposure. Color = risk band. Hover ring
// → highlight contributing positions.
//
// Performance budget: ≤ 8ms frame at 200 segments (Phase 24 §1.3).

import { memo, useMemo, useState } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { VIZ_PALETTE, vizColor, vizFont } from "./tokens.js";

export interface RadialSegment {
  protocol: string;
  ring: number;          // 0 = innermost
  weight: number;        // 0..=1, fraction of the ring
  riskBandBps: number;   // 0..=10_000; drives color band
  contributingPositions?: { asset: string; bps: number }[];
}

export interface RadialLiquidityMapProps extends AriaDescribed {
  segments: RadialSegment[];
  size?: number;
  /** Callback when a segment is selected. */
  onSelect?: (segment: RadialSegment) => void;
}

function RadialLiquidityMapImpl({
  segments,
  size = 360,
  description = "Radial liquidity map. Concentric rings group protocols; arc length encodes exposure.",
  dataTable,
}: RadialLiquidityMapProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();
  const [hovered, setHovered] = useState<RadialSegment | null>(null);

  const ringCount = useMemo(
    () => 1 + Math.max(0, ...segments.map((s) => s.ring)),
    [segments],
  );
  const cx = size / 2, cy = size / 2;
  const innerR = size * 0.18;
  const ringWidth = (size / 2 - innerR - 12) / Math.max(1, ringCount);

  const arcs = useMemo(() => {
    const out: Array<{ d: string; seg: RadialSegment; color: string }> = [];
    // Group by ring; lay arcs around the circle scaled by weight.
    const byRing: Record<number, RadialSegment[]> = {};
    for (const s of segments) (byRing[s.ring] ??= []).push(s);
    for (const [ringStr, group] of Object.entries(byRing)) {
      const ring = Number(ringStr);
      const r0 = innerR + ring * ringWidth;
      const r1 = r0 + ringWidth - 2;
      const total = group.reduce((a, b) => a + b.weight, 0) || 1;
      let theta = -Math.PI / 2;
      for (let i = 0; i < group.length; i++) {
        const seg = group[i];
        const span = (seg.weight / total) * Math.PI * 2;
        const a0 = theta;
        const a1 = theta + span;
        out.push({ d: arcPath(cx, cy, r0, r1, a0, a1), seg, color: bandToColor(seg.riskBandBps, i) });
        theta = a1;
      }
    }
    return out;
  }, [segments, cx, cy, innerR, ringWidth]);

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radial liquidity map" className="block w-full h-auto">
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={vizColor.line} />
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.d}
            fill={a.color}
            opacity={hovered && hovered !== a.seg ? 0.35 : 0.85}
            stroke={vizColor.line2}
            strokeWidth={hovered === a.seg ? 1 : 0.4}
            onMouseEnter={() => setHovered(a.seg)}
            onMouseLeave={() => setHovered((h) => (h === a.seg ? null : h))}
            style={{ cursor: "pointer", transition: "opacity 140ms cubic-bezier(0.4,0,0.2,1)" }}
          />
        ))}
        {hovered ? (
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontFamily={vizFont.mono} fill={vizColor.ink}>
            {hovered.protocol} · {(hovered.weight * 100).toFixed(1)}%
          </text>
        ) : (
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontFamily={vizFont.mono} fill={vizColor.ink3}>
            hover any arc
          </text>
        )}
      </svg>
      <button
        type="button"
        onClick={toggleTable}
        aria-expanded={showTable}
        style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
        className="mt-2 underline-offset-2 hover:underline"
      >
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Radial liquidity map data table" className="mt-2">
          {dataTable ?? <DefaultTable segments={segments} />}
        </div>
      ) : null}
    </figure>
  );
}

function DefaultTable({ segments }: { segments: RadialSegment[] }) {
  return (
    <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
      <thead>
        <tr><th align="left">protocol</th><th align="right">ring</th><th align="right">weight</th><th align="right">risk bps</th></tr>
      </thead>
      <tbody>
        {segments.map((s, i) => (
          <tr key={`${s.protocol}-${s.ring}-${i}`}>
            <td>{s.protocol}</td>
            <td align="right">{s.ring}</td>
            <td align="right">{(s.weight * 100).toFixed(2)}%</td>
            <td align="right">{s.riskBandBps}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function bandToColor(bps: number, i: number): string {
  if (bps >= 6_500) return vizColor.danger;
  if (bps >= 3_500) return vizColor.warn;
  if (bps >= 1_500) return VIZ_PALETTE[i % VIZ_PALETTE.length];
  return vizColor.execute;
}

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const x0 = cx + Math.cos(a0) * r1, y0 = cy + Math.sin(a0) * r1;
  const x1 = cx + Math.cos(a1) * r1, y1 = cy + Math.sin(a1) * r1;
  const x2 = cx + Math.cos(a1) * r0, y2 = cy + Math.sin(a1) * r0;
  const x3 = cx + Math.cos(a0) * r0, y3 = cy + Math.sin(a0) * r0;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

export const RadialLiquidityMap = memo(RadialLiquidityMapImpl);
RadialLiquidityMap.displayName = "RadialLiquidityMap";

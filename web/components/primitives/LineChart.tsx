// <LineChart> — pure SVG sparkline + area fill.
//
// Used for TVL history, APY trend, and the proofs-per-hour strip in
// the operator dashboard. No dependency on recharts/d3; layout
// math stays under 80 lines so SSR rendering is free.

"use client";

import { memo, useMemo } from "react";
import { cn } from "./cn";

export interface LinePoint {
  x: number;
  y: number;
}

export interface LineChartProps {
  data: LinePoint[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  smooth?: boolean;
  showDots?: boolean;
  className?: string;
}

function path(data: LinePoint[], w: number, h: number, smooth: boolean): { line: string; area: string } {
  if (data.length === 0) return { line: "", area: "" };
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const padY = h * 0.08;
  const innerH = h - padY * 2;

  const pts = data.map((d) => ({
    x: ((d.x - xMin) / xRange) * w,
    y: padY + innerH - ((d.y - yMin) / yRange) * innerH,
  }));

  let line = `M ${pts[0]!.x} ${pts[0]!.y}`;
  if (smooth) {
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]!;
      const p1 = pts[i]!;
      const cx = (p0.x + p1.x) / 2;
      line += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  } else {
    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i]!;
      line += ` L ${p1.x} ${p1.y}`;
    }
  }
  const area = `${line} L ${pts[pts.length - 1]!.x} ${h} L ${pts[0]!.x} ${h} Z`;
  return { line, area };
}

function LineChartImpl({
  data, width = 320, height = 80,
  stroke = "var(--color-accent-electric)",
  fill = "color-mix(in oklab, var(--color-accent-electric) 18%, transparent)",
  strokeWidth = 1.4,
  smooth = true,
  showDots = false,
  className,
}: LineChartProps): JSX.Element {
  const { line, area } = useMemo(() => path(data, width, height, smooth), [data, width, height, smooth]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full h-auto", className)}
      role="img"
    >
      {area && <path d={area} fill={fill} />}
      {line && <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />}
      {showDots && data.length > 0 && (() => {
        const xs = data.map((d) => d.x);
        const ys = data.map((d) => d.y);
        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
        const xRange = xMax - xMin || 1;
        const yRange = yMax - yMin || 1;
        const padY = height * 0.08;
        const innerH = height - padY * 2;
        return data.map((d, i) => (
          <circle
            key={i}
            cx={((d.x - xMin) / xRange) * width}
            cy={padY + innerH - ((d.y - yMin) / yRange) * innerH}
            r={1.6}
            fill={stroke}
          />
        ));
      })()}
    </svg>
  );
}

export const LineChart = memo(LineChartImpl);

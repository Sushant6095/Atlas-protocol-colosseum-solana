// <DonutChart> — vault allocation breakdown.
//
// Pure SVG (no recharts). Slices animate in via a stagger of
// `pathLength`-driven dasharray transitions. Center accepts a
// label/value slot so the host can render the active total.

"use client";

import { memo, useMemo, type ReactNode } from "react";
import { cn } from "./cn";

export interface DonutDatum {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
  className?: string;
}

const PALETTE = [
  "var(--color-accent-electric)",
  "var(--color-accent-zk)",
  "var(--color-accent-execute)",
  "var(--color-accent-warn)",
  "var(--color-accent-proof)",
  "var(--color-ink-tertiary)",
];

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function DonutChartImpl({
  data, size = 180, thickness = 18, center, className,
}: DonutChartProps): JSX.Element {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2, cy = size / 2;
  const r = (size - thickness) / 2;

  const slices = useMemo(() => {
    let a = -Math.PI / 2;
    return data.map((d, i) => {
      const span = (d.value / total) * Math.PI * 2;
      const start = a;
      const end = a + span;
      a = end;
      return {
        id: d.id,
        label: d.label,
        value: d.value,
        color: d.color ?? PALETTE[i % PALETTE.length]!,
        path: arc(cx, cy, r, start, end - 0.001),
      };
    });
  }, [data, cx, cy, r, total]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth={thickness} />
        {slices.map((s) => (
          <path
            key={s.id}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
          >
            <title>{`${s.label} — ${((s.value / total) * 100).toFixed(1)}%`}</title>
          </path>
        ))}
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {center}
        </div>
      )}
    </div>
  );
}

export const DonutChart = memo(DonutChartImpl);

// Sparkline — minimal SVG line. Used by allocation history,
// performance windows, attribution timelines. Linear; tokens only.

"use client";

import { memo, useMemo } from "react";
import { cn } from "@/components/primitives";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  /** Render the latest point as a small dot. */
  dot?: boolean;
}

function SparklineImpl({
  values,
  width = 120,
  height = 32,
  stroke = "var(--color-accent-electric)",
  fill,
  className,
  dot = true,
}: SparklineProps) {
  const { d, areaD, last } = useMemo(() => {
    if (values.length < 2) return { d: "", areaD: "", last: null };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const dx = width / (values.length - 1);
    const points = values.map((v, i) => [
      i * dx,
      height - ((v - min) / range) * (height - 4) - 2,
    ] as [number, number]);
    const d = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
    const areaD = `${d} L ${width} ${height} L 0 ${height} Z`;
    return { d, areaD, last: points[points.length - 1] };
  }, [values, width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("block", className)} aria-hidden>
      {fill ? <path d={areaD} fill={fill} opacity={0.25} /> : null}
      <path d={d} stroke={stroke} strokeWidth={1.2} fill="none" />
      {dot && last ? (
        <circle cx={last[0]} cy={last[1]} r={1.6} fill={stroke} />
      ) : null}
    </svg>
  );
}

export const Sparkline = memo(SparklineImpl);
Sparkline.displayName = "Sparkline";

// <BarChart> — minimal SVG bar chart, themed to Atlas tokens.
//
// No third-party chart lib (Recharts is heavy and brings its own
// theme assumptions). Each bar is a vertical gradient zk → electric,
// the most-recent bar uses a brighter execute → electric variant
// so the user's eye lands on it. Bars rise from 0 height on mount
// over 800ms with 60ms stagger.
//
// Tooltip on hover shows the exact value mono-formatted. Y-axis
// shows three gridlines (min / mid / max) with mono labels.

"use client";

import { memo, useEffect, useId, useState } from "react";
import { clsx } from "clsx";

export interface BarDatum {
  label: string;       // x-axis label, lowercase mono ("may")
  value: number;       // numeric value
  /** Optional override formatter for the tooltip value. */
  display?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Format y-axis ticks + tooltip values. */
  format?: (n: number) => string;
  /** Mark the highlighted (typically last/most-recent) bar. Default: last. */
  highlightIndex?: number;
  className?: string;
}

const DEFAULT_FORMAT = (n: number): string => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function BarChartImpl({
  data, format = DEFAULT_FORMAT, highlightIndex, className,
}: BarChartProps): JSX.Element {
  const id = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const max = Math.max(1, ...data.map((d) => d.value));
  const mid = Math.round(max / 2);
  const W = 720;
  const H = 280;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.min(48, slot * 0.6);
  const highlight = highlightIndex ?? data.length - 1;

  return (
    <div className={clsx("relative w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Monthly earnings">
        <defs>
          <linearGradient id={`bar-default-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A682FF" />
            <stop offset="1" stopColor="#3F8CFF" />
          </linearGradient>
          <linearGradient id={`bar-active-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3CE39A" />
            <stop offset="1" stopColor="#3F8CFF" />
          </linearGradient>
        </defs>

        {/* y-axis gridlines + labels */}
        {[max, mid, 0].map((v, i) => {
          const y = PAD_T + (innerH * i) / 2;
          return (
            <g key={i}>
              <line
                x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke="var(--color-line-soft)"
                strokeDasharray={i === 2 ? "0" : "2 4"}
              />
              <text
                x={PAD_L - 8} y={y + 4} textAnchor="end"
                className="font-mono"
                fontSize={10}
                fill="var(--color-ink-tertiary)"
              >
                {format(v)}
              </text>
            </g>
          );
        })}

        {/* bars */}
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = PAD_T + (innerH - h);
          const isHighlight = i === highlight;
          const grad = isHighlight ? `bar-active-${id}` : `bar-default-${id}`;
          const isHover = hovered === i;
          const animatedH = mounted ? h : 0;
          const animatedY = mounted ? y : PAD_T + innerH;

          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered((cur) => (cur === i ? null : cur))}>
              <rect
                x={x} y={animatedY} width={barW} height={animatedH}
                fill={`url(#${grad})`}
                rx={2}
                opacity={hovered != null && !isHover ? 0.5 : 1}
                style={{
                  transition: `y 800ms cubic-bezier(0.20,0.80,0.20,1.00) ${i * 60}ms,
                               height 800ms cubic-bezier(0.20,0.80,0.20,1.00) ${i * 60}ms,
                               opacity 220ms ease`,
                }}
              />
              <text
                x={x + barW / 2} y={H - 14} textAnchor="middle"
                className="font-mono lowercase"
                fontSize={10}
                fill={isHighlight ? "var(--color-ink-primary)" : "var(--color-ink-tertiary)"}
              >
                {d.label}
              </text>
              {/* Hover tooltip */}
              {isHover && (
                <g>
                  <rect
                    x={x + barW / 2 - 56} y={animatedY - 32}
                    width={112} height={24} rx={4}
                    fill="var(--color-surface-raised)"
                    stroke="var(--color-line-medium)"
                  />
                  <text
                    x={x + barW / 2} y={animatedY - 16} textAnchor="middle"
                    className="font-mono tabular-nums"
                    fontSize={11}
                    fill="var(--color-ink-primary)"
                  >
                    {d.display ?? format(d.value)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const BarChart = memo(BarChartImpl);
BarChart.displayName = "BarChart";

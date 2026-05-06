// RiskRadarMini — six-axis radar reused on /vault/[id] (Phase 23 §2.2)
// and /risk (Phase 22). Tokens only.

"use client";

import { memo } from "react";

export interface RadarValue { axis: string; value: number /* 0..=1 */ }

interface Props {
  values: RadarValue[];
  size?: number;
}

function RiskRadarMiniImpl({ values, size = 220 }: Props) {
  const cx = size / 2, cy = size / 2;
  const r = (size / 2) - 28;
  const N = values.length;
  const points = values.map((v, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return [cx + Math.cos(a) * r * v.value, cy + Math.sin(a) * r * v.value];
  });
  const path = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ") + " Z";
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block w-full h-auto">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={values.map((_, i) => {
            const a = (i / N) * 2 * Math.PI - Math.PI / 2;
            return `${cx + Math.cos(a) * r * k},${cy + Math.sin(a) * r * k}`;
          }).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1}
        />
      ))}
      <path d={path} fill="rgba(166,130,255,0.18)" stroke="#A682FF" strokeWidth={1.2} />
      {values.map((v, i) => {
        const a = (i / N) * 2 * Math.PI - Math.PI / 2;
        return (
          <text
            key={v.axis}
            x={cx + Math.cos(a) * (r + 14)}
            y={cy + Math.sin(a) * (r + 14) + 3}
            textAnchor="middle"
            fontSize={9} className="font-mono" fill="#9AA3B5"
          >
            {v.axis}
          </text>
        );
      })}
    </svg>
  );
}

export const RiskRadarMini = memo(RiskRadarMiniImpl);
RiskRadarMini.displayName = "RiskRadarMini";

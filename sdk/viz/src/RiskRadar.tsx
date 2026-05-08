// RiskRadar — six-axis radar (Phase 24 §1.2).

import { memo } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor, vizFont } from "./tokens.js";

export interface RadarAxis { axis: string; value: number /* 0..=1 */ }

export interface RiskRadarProps extends AriaDescribed {
  values: RadarAxis[];
  size?: number;
}

function RiskRadarImpl({
  values, size = 220,
  description = "Risk radar. Six axes: tail, liquidity, oracle, concentration, leverage, drawdown.",
  dataTable,
}: RiskRadarProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();
  const cx = size / 2, cy = size / 2;
  const r = (size / 2) - 28;
  const N = values.length;
  const points = values.map((v, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return [cx + Math.cos(a) * r * v.value, cy + Math.sin(a) * r * v.value];
  });
  const path = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ") + " Z";

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Risk radar" className="block w-full h-auto">
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <polygon
            key={k}
            points={values.map((_, i) => {
              const a = (i / N) * 2 * Math.PI - Math.PI / 2;
              return `${cx + Math.cos(a) * r * k},${cy + Math.sin(a) * r * k}`;
            }).join(" ")}
            fill="none" stroke={vizColor.line} strokeWidth={1}
          />
        ))}
        <path
          d={path}
          fill={vizColor.zk}
          fillOpacity={0.18}
          stroke={vizColor.zk}
          strokeWidth={1.2}
          style={{ transition: "d 220ms cubic-bezier(0.40,0.00,0.20,1.00)" }}
        />
        {values.map((v, i) => {
          const a = (i / N) * 2 * Math.PI - Math.PI / 2;
          return (
            <text
              key={v.axis}
              x={cx + Math.cos(a) * (r + 14)}
              y={cy + Math.sin(a) * (r + 14) + 3}
              textAnchor="middle"
              fontSize={10}
              fontFamily={vizFont.mono}
              fill={vizColor.ink2}
            >
              {v.axis}
            </text>
          );
        })}
      </svg>
      <button type="button" onClick={toggleTable} aria-expanded={showTable}
              style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
              className="mt-2 underline-offset-2 hover:underline">
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Radar values table" className="mt-2">
          {dataTable ?? (
            <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
              <thead><tr><th align="left">axis</th><th align="right">value</th></tr></thead>
              <tbody>
                {values.map((v) => (
                  <tr key={v.axis}><td>{v.axis}</td><td align="right">{(v.value * 100).toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </figure>
  );
}

export const RiskRadar = memo(RiskRadarImpl);
RiskRadar.displayName = "RiskRadar";

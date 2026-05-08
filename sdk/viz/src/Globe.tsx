// Globe — landing-hero globe (Phase 24 §1.2).
//
// Production renderer is r3f + drei + a custom shader. The component
// below ships the contract surface + a deterministic 2D projection
// fallback used under reduced-motion / low-end hardware (Phase 20
// §5.4) and SSR. Markers + arcs render on the projection so the
// "globe pulses on rebalance" demo moment works even in the
// fallback.
//
// Performance budget: 60 fps with FPS supervisor (Part 1 §5.2).

import { memo, useMemo } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor, vizFont } from "./tokens.js";

export interface GlobeMarker {
  id: string;
  /** Latitude / longitude in degrees. */
  lat: number;
  lon: number;
  /** Optional pulse — typically tied to a fresh rebalance event. */
  pulse?: boolean;
  label?: string;
}

export interface GlobeProps extends AriaDescribed {
  size?: number;
  markers?: GlobeMarker[];
  /** Source/dest pairs for arc overlays. */
  arcs?: { fromId: string; toId: string }[];
  /** Frame budget multiplier from the host scene supervisor. */
  updateMultiplier?: number;
}

function GlobeImpl({
  size = 480, markers = [], arcs = [],
  description = "Atlas globe. Markers indicate active proof regions; arcs indicate cross-region rebalances.",
}: GlobeProps) {
  const { describedBy } = useVizA11y();

  const positioned = useMemo(() => {
    const r = size / 2 - 8;
    const cx = size / 2, cy = size / 2;
    return markers.map((m) => {
      // Equirectangular projection — coarse but stable for the fallback.
      const x = cx + ((m.lon + 180) / 360 - 0.5) * (r * 2 * 0.9);
      const y = cy - ((m.lat + 90) / 180 - 0.5) * (r * 2 * 0.9);
      return { ...m, x, y };
    });
  }, [markers, size]);
  const byId = useMemo(() => new Map(positioned.map((p) => [p.id, p])), [positioned]);

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Atlas globe" className="block w-full h-auto">
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8}
                fill="rgba(63,140,255,0.06)" stroke={vizColor.line2} />
        {/* Latitude lines */}
        {[-60, -30, 0, 30, 60].map((lat) => {
          const r = (size / 2 - 8) * Math.cos((lat / 90) * (Math.PI / 2));
          return (
            <ellipse key={lat} cx={size / 2} cy={size / 2}
                     rx={r} ry={(size / 2 - 8) * 0.18}
                     fill="none" stroke={vizColor.line} strokeOpacity={0.4} />
          );
        })}
        {/* Arcs */}
        {arcs.map((a, i) => {
          const from = byId.get(a.fromId);
          const to   = byId.get(a.toId);
          if (!from || !to) return null;
          const cx = (from.x + to.x) / 2;
          const cy = (from.y + to.y) / 2 - 24;
          return (
            <path key={i}
                  d={`M ${from.x} ${from.y} Q ${cx} ${cy}, ${to.x} ${to.y}`}
                  stroke={vizColor.proof} strokeWidth={0.8} strokeOpacity={0.7}
                  fill="none" />
          );
        })}
        {/* Markers */}
        {positioned.map((m) => (
          <g key={m.id} transform={`translate(${m.x}, ${m.y})`}>
            {m.pulse ? (
              <circle r={9} fill="none" stroke={vizColor.zk} strokeOpacity={0.55}>
                <animate attributeName="r" from={3} to={11} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" from={0.65} to={0} dur="1.6s" repeatCount="indefinite" />
              </circle>
            ) : null}
            <circle r={2.4} fill={m.pulse ? vizColor.zk : vizColor.electric} />
            {m.label ? (
              <text y={-6} textAnchor="middle" fontSize={9} fontFamily={vizFont.mono} fill={vizColor.ink3}>
                {m.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </figure>
  );
}

export const Globe = memo(GlobeImpl);
Globe.displayName = "Globe";

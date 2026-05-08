// ZkLattice — procedural lattice for the proof aesthetic
// (Phase 24 §1.2). Atlas's signature visual element.
//
// Production renderer is shader-driven (r3f + custom GLSL). The
// component below is the deterministic CSS/SVG fallback used when
// WebGL is unavailable, the user prefers reduced motion, or the
// device falls below the Phase 20 §5.4 low-end threshold.
//
// Performance budget: 60 fps; LOD tiers active.

import { memo, useEffect, useRef } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor } from "./tokens.js";

export interface ZkLatticeProps extends AriaDescribed {
  size?: number;
  /** Frame multiplier from the host's scene supervisor (1 = 60fps target). */
  updateMultiplier?: number;
  /** Freeze: render the first frame and stop. */
  freeze?: boolean;
}

function ZkLatticeImpl({
  size = 480,
  updateMultiplier = 1,
  freeze = false,
  description = "Procedural recursive lattice — visualizes the Atlas zk-proof structure.",
}: ZkLatticeProps) {
  const { describedBy } = useVizA11y();
  const ref = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (freeze) return;
    const tick = () => {
      offsetRef.current = (offsetRef.current + 0.6 * updateMultiplier) % 360;
      ref.current?.style.setProperty("--lattice-rot", `${offsetRef.current}deg`);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [freeze, updateMultiplier]);

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <div
        ref={ref}
        aria-hidden
        style={{
          position: "relative",
          width: size, height: size,
          ["--lattice-rot" as never]: "0deg",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: "50%", opacity: 0.6,
            background: "radial-gradient(circle at 50% 50%, rgba(166,130,255,0.35), rgba(63,140,255,0.10) 40%, transparent 70%)",
            filter: "blur(6px)",
          }}
        />
        <svg viewBox="-100 -100 200 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "rotate(var(--lattice-rot))" }}>
          <defs>
            <linearGradient id="zkGrad" x1="0%" x2="100%">
              <stop offset="0%"  stopColor={vizColor.electric} />
              <stop offset="50%" stopColor={vizColor.zk} />
              <stop offset="100%" stopColor={vizColor.proof} />
            </linearGradient>
          </defs>
          {[88, 72, 56, 40, 26].map((r, i) => (
            <circle key={r} cx={0} cy={0} r={r} fill="none"
                    stroke="url(#zkGrad)" strokeOpacity={0.28 + i * 0.08}
                    strokeWidth={0.6} strokeDasharray={`${r * 0.04} ${r * 0.08}`} />
          ))}
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * 2 * Math.PI;
            return (
              <line key={i} x1={0} y1={0}
                    x2={Math.cos(a) * 88} y2={Math.sin(a) * 88}
                    stroke="url(#zkGrad)" strokeOpacity={0.14} strokeWidth={0.4} />
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

export const ZkLattice = memo(ZkLatticeImpl);
ZkLattice.displayName = "ZkLattice";

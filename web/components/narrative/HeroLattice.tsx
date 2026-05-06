// HeroLattice — pure-CSS proof lattice for the landing hero
// (Phase 22 §1.2). 3D r3f globe is reserved for Phase 24; this
// is the always-runs SVG/CSS placeholder.

"use client";

import { memo, useEffect, useRef } from "react";
import { useSceneSupervisor } from "@/lib/three/supervisor";
import { cn } from "@/components/primitives";

function HeroLatticeImpl() {
  const ref = useRef<HTMLDivElement>(null);
  const { freeze, updateMultiplier } = useSceneSupervisor(ref, { surface: "landing" });
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (freeze) return;
    const tick = () => {
      offsetRef.current = (offsetRef.current + 0.6 * updateMultiplier) % 360;
      const el = ref.current;
      if (el) {
        el.style.setProperty("--lattice-rot", `${offsetRef.current}deg`);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [freeze, updateMultiplier]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "relative aspect-square w-full max-w-[560px] mx-auto",
        "[--lattice-rot:0deg]",
      )}
    >
      {/* Outer halo */}
      <div
        className="absolute inset-0 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(166,130,255,0.35), rgba(63,140,255,0.10) 40%, transparent 70%)",
          filter: "blur(8px)",
        }}
      />
      {/* Concentric rings — rotate via CSS variable */}
      <svg
        viewBox="-100 -100 200 200"
        className="absolute inset-0 w-full h-full"
        style={{ transform: "rotate(var(--lattice-rot))" }}
      >
        {[88, 72, 56, 40, 26].map((r, i) => (
          <circle
            key={r}
            cx={0}
            cy={0}
            r={r}
            fill="none"
            stroke="url(#latticeGrad)"
            strokeOpacity={0.28 + i * 0.08}
            strokeWidth={0.6}
            strokeDasharray={`${r * 0.04} ${r * 0.08}`}
          />
        ))}
        <defs>
          <linearGradient id="latticeGrad" x1="0%" x2="100%">
            <stop offset="0%"  stopColor="#3F8CFF" />
            <stop offset="50%" stopColor="#A682FF" />
            <stop offset="100%" stopColor="#F478C6" />
          </linearGradient>
        </defs>
        {/* Spokes */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * 2 * Math.PI;
          return (
            <line
              key={i}
              x1={0}
              y1={0}
              x2={Math.cos(a) * 88}
              y2={Math.sin(a) * 88}
              stroke="url(#latticeGrad)"
              strokeOpacity={0.14}
              strokeWidth={0.4}
            />
          );
        })}
      </svg>
      {/* Counter-rotating inner */}
      <svg
        viewBox="-50 -50 100 100"
        className="absolute inset-1/4 w-1/2 h-1/2"
        style={{ transform: "rotate(calc(var(--lattice-rot) * -2))" }}
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * 2 * Math.PI;
          return (
            <circle
              key={i}
              cx={Math.cos(a) * 28}
              cy={Math.sin(a) * 28}
              r={3}
              fill="#A682FF"
              fillOpacity={0.55}
            />
          );
        })}
        <circle cx={0} cy={0} r={6} fill="#3F8CFF" fillOpacity={0.65} />
      </svg>
    </div>
  );
}

export const HeroLattice = memo(HeroLatticeImpl);
HeroLattice.displayName = "HeroLattice";

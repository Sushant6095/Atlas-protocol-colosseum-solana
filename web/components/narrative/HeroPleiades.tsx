// HeroPleiades — landing-hero brand treatment.
//
// React-rendered Pleiades constellation derived from
// `/public/brand/atlas-pleiades.svg`. Each star is wrapped in a
// `motion.circle` so we can:
//
//   - fade them in sequentially on mount (40 ms stagger), reading
//     left-to-right then settling on consensus;
//   - run a slow pulse on the consensus star — opacity 0.7↔1.0,
//     scale 1.0↔1.08, ease-in-out, 2.5 s loop. The pulse is the
//     only ongoing motion on the surface.
//
// Background is fully transparent — the cosmic dark comes from the
// page surface (`hero-spotlight` + `hero-grid` utilities), not the
// SVG. Reduced-motion users get the static constellation with all
// stars at full opacity, no pulse.

"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { memo } from "react";
import { cn } from "@/components/primitives";

const ENTRY_STAGGER_S = 0.04;

// Star ordering controls fade-in sequence: apex first (verification
// point at the top), then arms outward, settling on consensus.
interface Star {
  cx: number; cy: number;
  /** Outer halo radius. */
  r: number;
  /** Inner glint radius. */
  rInner: number;
  fill: string;
  innerFill?: string;
  /** Order in the entrance stagger. */
  step: number;
  /** True for the consensus star — gets the slow pulse. */
  pulse?: boolean;
}

const STARS: Star[] = [
  // 1. apex (verification)
  { cx: 32, cy:  8, r: 2.4, rInner: 1.0, fill: "#3F8CFF",                    step: 0 },
  // 2. upper-left arm
  { cx: 22, cy: 27, r: 1.8, rInner: 0.7, fill: "#A682FF",                    step: 1 },
  // 3. upper-right arm
  { cx: 42, cy: 27, r: 1.8, rInner: 0.7, fill: "#A682FF",                    step: 1 },
  // 4. consensus — the only star that pulses
  { cx: 32, cy: 38, r: 3.2, rInner: 0.9, fill: "#FFFFFF", innerFill: "#3F8CFF", step: 2, pulse: true },
  // 5. lower-left arm
  { cx: 14, cy: 48, r: 1.8, rInner: 0.7, fill: "#F478C6",                    step: 3 },
  // 6. lower-right arm
  { cx: 50, cy: 48, r: 1.8, rInner: 0.7, fill: "#F478C6",                    step: 3 },
  // 7. base (foundation)
  { cx: 32, cy: 56, r: 1.4, rInner: 0.5, fill: "#3CE39A",                    step: 4 },
];

const SKELETON_LINES: { x1: number; y1: number; x2: number; y2: number }[] = [
  { x1: 32, y1:  8, x2: 22, y2: 27 }, // left arm upper
  { x1: 22, y1: 27, x2: 14, y2: 48 }, // left arm lower
  { x1: 32, y1:  8, x2: 42, y2: 27 }, // right arm upper
  { x1: 42, y1: 27, x2: 50, y2: 48 }, // right arm lower
  { x1: 22, y1: 27, x2: 32, y2: 38 }, // crossbar L
  { x1: 32, y1: 38, x2: 42, y2: 27 }, // crossbar R
];

const fadeStar: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  visible: (step: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.20 + step * ENTRY_STAGGER_S,
      duration: 0.45,
      ease: [0.20, 0.80, 0.20, 1.00],
    },
  }),
};

const fadeLine: Variants = {
  hidden:  { pathLength: 0, opacity: 0 },
  visible: (step: number) => ({
    pathLength: 1,
    opacity: 0.85,
    transition: {
      delay: step * ENTRY_STAGGER_S,
      duration: 0.55,
      ease: [0.20, 0.80, 0.20, 1.00],
    },
  }),
};

const consensusPulse = {
  scale:   [1, 1.08, 1],
  opacity: [0.7, 1.0, 0.7],
};

export interface HeroPleiadesProps {
  /** Square render size. Default 540. */
  size?: number;
  className?: string;
  /** Optional title for assistive tech. */
  title?: string;
}

function HeroPleiadesImpl({
  size = 540, className, title = "Atlas — Pleiades constellation",
}: HeroPleiadesProps): JSX.Element {
  const reduced = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block max-w-full max-h-full", className)}
      style={{ overflow: "visible" }}
      initial="hidden"
      animate="visible"
    >
      <title>{title}</title>

      <defs>
        {/* Constellation skeleton gradient — zk-violet → electric. */}
        <linearGradient id="heroPleiadesLine" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A682FF" />
          <stop offset="0.55" stopColor="#5B8CFF" />
          <stop offset="1" stopColor="#3F8CFF" />
        </linearGradient>

        {/* Consensus halo — soft white core radiating into electric and zk. */}
        <radialGradient id="heroPleiadesConsensus" cx="32" cy="38" r="10" gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor="#3F8CFF" />
          <stop offset="0.70" stopColor="#A682FF" stopOpacity="0.40" />
          <stop offset="1"    stopColor="#A682FF" stopOpacity="0" />
        </radialGradient>

        {/* Apex halo — verification light. */}
        <radialGradient id="heroPleiadesApex" cx="32" cy="8" r="5" gradientUnits="userSpaceOnUse">
          <stop offset="0"   stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#3F8CFF" />
          <stop offset="1"   stopColor="#3F8CFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Constellation skeleton — six segments forming the A. */}
      <g
        stroke="url(#heroPleiadesLine)"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      >
        {SKELETON_LINES.map((l, i) => (
          <motion.line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            custom={i}
            variants={fadeLine}
          />
        ))}
      </g>

      {/* Consensus halo + pulse. The halo is what pulses — the
          inner glints are static so the eye reads "the centre is
          breathing", not "the dot is wobbling." */}
      <motion.circle
        cx={32} cy={38} r={9}
        fill="url(#heroPleiadesConsensus)"
        initial={{ opacity: 0 }}
        animate={
          reduced
            ? { opacity: 0.85, transition: { delay: 0.6, duration: 0.4 } }
            : {
                opacity: consensusPulse.opacity,
                scale:   consensusPulse.scale,
                transition: {
                  delay: 0.6,
                  opacity: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                  scale:   { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                },
              }
        }
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />

      {/* Apex halo — static, soft. */}
      <motion.circle
        cx={32} cy={8} r={4}
        fill="url(#heroPleiadesApex)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85, transition: { delay: 0.18, duration: 0.5 } }}
      />

      {/* Seven stars. Outer halo + inner glint per star. The
          consensus star carries an extra middle layer (electric core
          inside the white halo) and pulses with the consensus halo. */}
      {STARS.map((s, i) => (
        <g key={i} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          {/* Outer halo */}
          <motion.circle
            cx={s.cx} cy={s.cy} r={s.r}
            fill={s.fill}
            custom={s.step}
            variants={fadeStar}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          {/* Middle layer for consensus only */}
          {s.innerFill && (
            <motion.circle
              cx={s.cx} cy={s.cy} r={2.0}
              fill={s.innerFill}
              custom={s.step}
              variants={fadeStar}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          )}
          {/* Inner glint */}
          <motion.circle
            cx={s.cx} cy={s.cy} r={s.rInner}
            fill="#FFFFFF"
            custom={s.step}
            variants={fadeStar}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        </g>
      ))}

      {/* Foundation tick — dashed horizon under the base star. */}
      <motion.line
        x1={14} y1={56} x2={50} y2={56}
        stroke="#3F8CFF"
        strokeWidth={0.4}
        strokeDasharray="0.5 1.5"
        opacity={0.35}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.35, transition: { delay: 0.7, duration: 0.6 } }}
      />
    </motion.svg>
  );
}

export const HeroPleiades = memo(HeroPleiadesImpl);
HeroPleiades.displayName = "HeroPleiades";

"use client";

import { motion } from "framer-motion";

const steps = [
  { id: "state", label: "Onchain state", color: "#29d3ff", x: 60, y: 80 },
  { id: "model", label: "AI model (MLP)", color: "#7c5cff", x: 260, y: 80 },
  { id: "sp1", label: "SP1 zkVM", color: "#ff5cf0", x: 460, y: 80 },
  { id: "wrap", label: "Groth16 wrap", color: "#f7c948", x: 460, y: 220 },
  { id: "verify", label: "Onchain verify", color: "#29d391", x: 260, y: 220 },
  { id: "exec", label: "Execute rebalance", color: "#ffffff", x: 60, y: 220 },
];

const edges = [
  ["state", "model"],
  ["model", "sp1"],
  ["sp1", "wrap"],
  ["wrap", "verify"],
  ["verify", "exec"],
];

export function ProofPipeline() {
  const lookup = Object.fromEntries(steps.map((s) => [s.id, s]));

  return (
    <div className="relative w-full">
      <svg viewBox="0 0 600 320" className="w-full h-auto">
        <defs>
          <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c5cff" />
            <stop offset="100%" stopColor="#29d3ff" />
          </linearGradient>
          <filter id="soft">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {edges.map(([from, to], i) => {
          const a = lookup[from];
          const b = lookup[to];
          return (
            <g key={i}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="url(#edge)"
                strokeWidth="2"
                strokeOpacity="0.3"
              />
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="url(#edge)"
                strokeWidth="2"
                className="flow-line"
              />
              <motion.circle
                r="4"
                fill="#fff"
                style={{
                  filter: "drop-shadow(0 0 6px #7c5cff)",
                }}
                animate={{
                  cx: [a.x, b.x],
                  cy: [a.y, b.y],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </g>
          );
        })}

        {steps.map((s, i) => (
          <motion.g
            key={s.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            <circle cx={s.x} cy={s.y} r="28" fill={s.color} fillOpacity="0.15" filter="url(#soft)" />
            <circle cx={s.x} cy={s.y} r="20" fill={s.color} fillOpacity="0.25" stroke={s.color} strokeWidth="1.5" />
            <circle cx={s.x} cy={s.y} r="6" fill={s.color}>
              <animate attributeName="r" values="6;9;6" dur="2.4s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
            </circle>
            <text
              x={s.x}
              y={s.y + 50}
              textAnchor="middle"
              className="fill-white"
              fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {s.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

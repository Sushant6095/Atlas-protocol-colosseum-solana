"use client";
import { motion } from "framer-motion";

export function AnimPrewarm() {
  return (
    <svg viewBox="0 0 200 130" className="h-full w-auto">
      {/* track */}
      <rect x={20} y={60} width={160} height={10} rx={5} fill="#0B0D12" stroke="#5D6577" strokeOpacity={0.3} strokeWidth={0.5} />
      {/* deadline marker */}
      <line x1={170} y1={50} x2={170} y2={80} stroke="#FF6166" strokeWidth={1.5} />
      <text x={170} y={45} fill="#FF6166" fontSize={7} fontFamily="monospace" textAnchor="middle">DEADLINE</text>
      {/* buffer fill */}
      <motion.rect
        x={20} y={60} height={10} rx={5}
        fill="url(#prewarm-grad)"
        animate={{ width: [0, 60, 100, 140, 0] }}
        transition={{ duration: 5, repeat: Infinity, times: [0, 0.25, 0.5, 0.85, 1] }}
      />
      {/* proof markers */}
      {[60, 100, 140].map((x, i) => (
        <motion.circle
          key={i} cx={20 + x} cy={65} r={2.5}
          fill="#3CE39A"
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1.5, 1, 0.5] }}
          transition={{ duration: 5, repeat: Infinity, delay: i * 1.2 }}
        />
      ))}
      <defs>
        <linearGradient id="prewarm-grad" x1="0" x2="1">
          <stop offset="0" stopColor="#3F8CFF" />
          <stop offset="1" stopColor="#3CE39A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

"use client";
import { motion } from "framer-motion";

export function AnimPrivateExec() {
  return (
    <svg viewBox="0 0 200 130" className="h-full w-auto">
      {/* mainnet line on left */}
      <line x1={15} y1={65} x2={50} y2={65} stroke="#5D6577" strokeWidth={0.6} strokeDasharray="2 2" />
      <text x={15} y={55} fill="#9AA3B5" fontSize={6} fontFamily="monospace">MAINNET</text>

      {/* ER container box */}
      <rect x={55} y={35} width={90} height={60} rx={4}
            fill="url(#per-grad)" fillOpacity={0.08}
            stroke="#A682FF" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={100} y={30} textAnchor="middle" fill="#A682FF" fontSize={6} fontFamily="monospace">EPHEMERAL ROLLUP</text>

      {/* mainnet line on right */}
      <line x1={150} y1={65} x2={185} y2={65} stroke="#5D6577" strokeWidth={0.6} strokeDasharray="2 2" />
      <text x={185} y={55} fill="#9AA3B5" fontSize={6} fontFamily="monospace" textAnchor="end">SETTLE</text>

      {/* particles entering, swirling, exiting */}
      {[0, 0.3, 0.6, 0.9].map((delay, i) => (
        <motion.circle
          key={i} r={2.5} fill="#3F8CFF"
          animate={{
            cx: [15, 55, 75, 100, 130, 145, 185],
            cy: [65, 65, 50, 80, 50, 65, 65],
            opacity: [0, 1, 0.6, 0.6, 0.6, 1, 0],
          }}
          transition={{ duration: 4, repeat: Infinity, delay, times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1] }}
        />
      ))}

      <defs>
        <linearGradient id="per-grad" x1="0" x2="1">
          <stop offset="0" stopColor="#A682FF" />
          <stop offset="1" stopColor="#3F8CFF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

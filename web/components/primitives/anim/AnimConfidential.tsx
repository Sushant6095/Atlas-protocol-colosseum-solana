"use client";
import { motion } from "framer-motion";

export function AnimConfidential() {
  return (
    <svg viewBox="0 0 200 130" className="h-full w-auto">
      {/* pie slices — always visible */}
      <g transform="translate(70 65)">
        <path d="M 0 0 L 30 0 A 30 30 0 0 1 9 28.5 Z" fill="#3F8CFF" fillOpacity={0.6} />
        <path d="M 0 0 L 9 28.5 A 30 30 0 0 1 -24 18 Z" fill="#A682FF" fillOpacity={0.6} />
        <path d="M 0 0 L -24 18 A 30 30 0 0 1 -24 -18 Z" fill="#F478C6" fillOpacity={0.6} />
        <path d="M 0 0 L -24 -18 A 30 30 0 0 1 30 0 Z" fill="#3CE39A" fillOpacity={0.6} />
        <text x={0} y={50} textAnchor="middle" fill="#9AA3B5" fontSize={7} fontFamily="monospace">RATIOS · PUBLIC</text>
      </g>

      {/* notional dollar amounts — toggle hidden/visible */}
      <g transform="translate(150 65)">
        {[{y:-20,c:"#3F8CFF"},{y:0,c:"#A682FF"},{y:20,c:"#F478C6"}].map((row, i) => (
          <motion.g
            key={i}
            animate={{ opacity: [0, 0, 1, 1, 0] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.3, 0.5, 0.85, 1], delay: i * 0.08 }}
          >
            <text x={0} y={row.y} fill={row.c} fontSize={9} fontFamily="monospace" textAnchor="middle">$••••</text>
          </motion.g>
        ))}
        {/* lock when hidden */}
        <motion.g
          animate={{ opacity: [1, 1, 0, 0, 1] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.3, 0.5, 0.85, 1] }}
        >
          <rect x={-12} y={-12} width={24} height={24} rx={3} fill="none" stroke="#5D6577" strokeWidth={1} />
          <path d="M -5 -5 a 5 5 0 0 1 10 0 v 5" fill="none" stroke="#5D6577" strokeWidth={1} />
        </motion.g>
        <text x={0} y={50} textAnchor="middle" fill="#9AA3B5" fontSize={7} fontFamily="monospace">NOTIONALS · KEY-GATED</text>
      </g>
    </svg>
  );
}

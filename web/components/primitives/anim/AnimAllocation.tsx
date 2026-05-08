"use client";
import { motion } from "framer-motion";

const AGENT_COLORS = ["#3F8CFF", "#F7B955", "#A682FF", "#FF6166", "#3CE39A", "#F478C6", "#F7B955"];

export function AnimAllocation() {
  const cx = 100, cy = 65, r = 40;
  const agents = AGENT_COLORS.map((color, i) => {
    const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, color, delay: i * 0.18 };
  });

  return (
    <svg viewBox="0 0 200 130" className="h-full w-auto">
      {/* lines from agents to center */}
      {agents.map((a, i) => (
        <motion.line
          key={`l-${i}`} x1={a.x} y1={a.y} x2={cx} y2={cy}
          stroke={a.color} strokeWidth={0.8}
          animate={{ opacity: [0.15, 0.6, 0.15], strokeDasharray: ["0 100", "8 4", "0 100"] }}
          transition={{ duration: 3, repeat: Infinity, delay: a.delay }}
        />
      ))}
      {/* agent dots */}
      {agents.map((a, i) => (
        <motion.circle
          key={`a-${i}`} cx={a.x} cy={a.y} r={3.5}
          fill={a.color}
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, delay: a.delay }}
        />
      ))}
      {/* consensus center */}
      <motion.circle
        cx={cx} cy={cy} r={8}
        fill="#A682FF"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.circle
        cx={cx} cy={cy} r={14}
        fill="none" stroke="#A682FF" strokeWidth={0.6}
        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </svg>
  );
}

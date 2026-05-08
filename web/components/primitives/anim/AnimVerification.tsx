"use client";
import { motion } from "framer-motion";

export function AnimVerification() {
  const leaves = [{ x: 30 }, { x: 80 }, { x: 130 }, { x: 180 }];
  const intermediates = [{ x: 55 }, { x: 155 }];
  const root = { x: 105, y: 25 };

  return (
    <svg viewBox="0 0 210 130" className="h-full w-auto">
      {/* leaf-to-intermediate lines */}
      {leaves.map((l, i) => (
        <motion.line
          key={`li-${i}`}
          x1={l.x} y1={100}
          x2={i < 2 ? intermediates[0].x : intermediates[1].x} y2={60}
          stroke="#3F8CFF" strokeWidth={1} strokeOpacity={0.4}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 0.15, times: [0, 0.4, 0.85, 1] }}
        />
      ))}

      {/* intermediate-to-root lines */}
      {intermediates.map((m, i) => (
        <motion.line
          key={`ir-${i}`}
          x1={m.x} y1={60} x2={root.x} y2={root.y}
          stroke="#A682FF" strokeWidth={1.2} strokeOpacity={0.6}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 0, 1, 1, 0] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.5, 0.7, 0.85, 1] }}
        />
      ))}

      {/* leaves */}
      {leaves.map((l, i) => (
        <motion.circle
          key={`l-${i}`} cx={l.x} cy={100} r={3}
          fill="#3F8CFF"
          animate={{ opacity: [0.3, 1, 1, 0.3], scale: [1, 1.2, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}

      {/* intermediates */}
      {intermediates.map((m, i) => (
        <motion.circle
          key={`i-${i}`} cx={m.x} cy={60} r={4}
          fill="#A682FF"
          animate={{ opacity: [0.2, 0.2, 1, 1, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.55, 0.85, 1] }}
        />
      ))}

      {/* root */}
      <motion.circle
        cx={root.x} cy={root.y} r={6}
        fill="#3CE39A"
        animate={{ opacity: [0.15, 0.15, 0.15, 1, 1, 0.15], scale: [1, 1, 1, 1.4, 1, 1] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.6, 0.7, 0.78, 0.9, 1] }}
      />
      <motion.circle
        cx={root.x} cy={root.y} r={11}
        fill="#3CE39A" fillOpacity={0.2}
        animate={{ scale: [1, 1, 1, 2.2, 1], opacity: [0, 0, 0, 0.6, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.6, 0.75, 0.85, 1] }}
      />
    </svg>
  );
}

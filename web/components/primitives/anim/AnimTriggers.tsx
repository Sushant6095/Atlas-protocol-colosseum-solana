"use client";
import { motion } from "framer-motion";

export function AnimTriggers() {
  return (
    <svg viewBox="0 0 200 130" className="h-full w-auto">
      {/* threshold line */}
      <line x1={20} y1={75} x2={180} y2={75} stroke="#FF6166" strokeWidth={0.8} strokeDasharray="3 3" />
      <text x={185} y={77} fill="#FF6166" fontSize={6} fontFamily="monospace">THRESHOLD</text>

      {/* price line (animated path) */}
      <motion.path
        d="M 20 60 Q 50 50, 70 65 T 110 70 T 150 90 T 180 60"
        fill="none"
        stroke="#3F8CFF" strokeWidth={1.5}
        animate={{
          d: [
            "M 20 60 Q 50 50, 70 65 T 110 70 T 150 90 T 180 60",
            "M 20 70 Q 50 90, 70 80 T 110 65 T 150 50 T 180 75",
            "M 20 60 Q 50 50, 70 65 T 110 70 T 150 90 T 180 60",
          ],
        }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* gate icon */}
      <motion.g
        animate={{ x: [0, 0, 2, -2, 0], opacity: [1, 1, 0.6, 1, 1] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <rect x={155} y={20} width={20} height={20} rx={3} fill="none" stroke="#F478C6" strokeWidth={1.2} />
        <motion.line
          x1={160} y1={30} x2={170} y2={30}
          stroke="#F478C6" strokeWidth={1.2}
          animate={{ rotate: [0, 0, -45, -45, 0] }}
          style={{ originX: "165px", originY: "30px" }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </motion.g>
    </svg>
  );
}

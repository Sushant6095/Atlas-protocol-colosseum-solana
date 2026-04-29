"use client";

import { motion } from "framer-motion";

export function HeroOrb() {
  return (
    <div className="relative h-[420px] w-full flex items-center justify-center pointer-events-none">
      {/* outer ring */}
      <motion.div
        className="absolute h-[380px] w-[380px] rounded-full border border-[color:var(--color-border)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <span
            key={angle}
            className="absolute top-1/2 left-1/2 h-2 w-2 rounded-full bg-[color:var(--color-accent)]"
            style={{
              transform: `rotate(${angle}deg) translateY(-190px)`,
              boxShadow: "0 0 20px #7c5cff",
            }}
          />
        ))}
      </motion.div>

      {/* mid ring counter rotate */}
      <motion.div
        className="absolute h-[280px] w-[280px] rounded-full border border-[color:var(--color-border)]"
        animate={{ rotate: -360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {[45, 135, 225, 315].map((angle) => (
          <span
            key={angle}
            className="absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-2)]"
            style={{
              transform: `rotate(${angle}deg) translateY(-140px)`,
              boxShadow: "0 0 14px #29d3ff",
            }}
          />
        ))}
      </motion.div>

      {/* core */}
      <motion.div
        className="relative h-[180px] w-[180px] rounded-full"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #ffffff 0%, #7c5cff 30%, #29d3ff 60%, #1a0040 100%)",
          boxShadow:
            "0 0 80px 20px rgba(124,92,255,0.5), 0 0 200px 60px rgba(41,211,255,0.25)",
        }}
      >
        <div className="absolute inset-2 rounded-full mix-blend-overlay opacity-60"
          style={{
            background:
              "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.4), transparent, rgba(124,92,255,0.4), transparent)",
          }}
        />
        <div className="absolute inset-0 rounded-full flex items-center justify-center font-mono text-xs text-white/80 tracking-widest">
          ZK · ML · SVM
        </div>
      </motion.div>

      {/* particles */}
      {[...Array(6)].map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-white"
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{
            x: Math.cos((i / 6) * Math.PI * 2) * 220,
            y: Math.sin((i / 6) * Math.PI * 2) * 220,
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 3, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
          style={{ boxShadow: "0 0 10px #fff" }}
        />
      ))}
    </div>
  );
}

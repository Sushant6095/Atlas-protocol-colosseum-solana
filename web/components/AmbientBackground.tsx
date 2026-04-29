"use client";

import { motion } from "framer-motion";

const COARSE = {
  backgroundImage:
    "linear-gradient(rgba(150,130,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(150,130,255,0.22) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
} as const;

const FINE = {
  backgroundImage:
    "linear-gradient(rgba(120,220,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120,220,255,0.08) 1px, transparent 1px)",
  backgroundSize: "12px 12px",
} as const;

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* coarse grid */}
      <div className="absolute inset-0" style={COARSE} />
      {/* fine grid */}
      <div className="absolute inset-0" style={FINE} />

      {/* animated blobs over the grid */}
      <motion.div
        className="absolute top-[-15%] left-[5%] h-[500px] w-[500px] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, rgba(124,92,255,0.30) 0%, transparent 70%)" }}
        animate={{ x: [0, 80, -40, 0], y: [0, 40, 80, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[30%] right-[5%] h-[420px] w-[420px] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, rgba(41,211,255,0.20) 0%, transparent 70%)" }}
        animate={{ x: [0, -60, 40, 0], y: [0, 60, -40, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10%] left-[40%] h-[600px] w-[600px] rounded-full blur-[160px]"
        style={{ background: "radial-gradient(circle, rgba(255,92,240,0.14) 0%, transparent 70%)" }}
        animate={{ x: [0, 100, -80, 0], y: [0, -40, 40, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

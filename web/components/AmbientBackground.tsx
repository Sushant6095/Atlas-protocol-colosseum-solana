"use client";

import { motion } from "framer-motion";

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 grid-bg" />

      <motion.div
        className="absolute top-[-20%] left-[10%] h-[600px] w-[600px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(124,92,255,0.45) 0%, transparent 70%)" }}
        animate={{ x: [0, 80, -40, 0], y: [0, 40, 80, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20%] right-[5%] h-[500px] w-[500px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(41,211,255,0.32) 0%, transparent 70%)" }}
        animate={{ x: [0, -60, 40, 0], y: [0, 60, -40, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10%] left-[30%] h-[700px] w-[700px] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, rgba(255,92,240,0.22) 0%, transparent 70%)" }}
        animate={{ x: [0, 100, -80, 0], y: [0, -40, 40, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function Showcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1.0, 1.05]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.4]);

  return (
    <section ref={ref} className="relative h-[140vh] overflow-clip">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
        <motion.div style={{ y, scale }} className="absolute inset-0 -z-10">
          <svg viewBox="0 0 1600 900" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="sg1" cx="20%" cy="20%" r="60%">
                <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sg2" cx="80%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#29d3ff" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#29d3ff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sg3" cx="50%" cy="90%" r="60%">
                <stop offset="0%" stopColor="#ff5cf0" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ff5cf0" stopOpacity="0" />
              </radialGradient>
              <filter id="sgrain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
                <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0" />
              </filter>
            </defs>
            <rect width="1600" height="900" fill="#06060a" />
            <rect width="1600" height="900" fill="url(#sg1)" />
            <rect width="1600" height="900" fill="url(#sg2)" />
            <rect width="1600" height="900" fill="url(#sg3)" />
            <rect width="1600" height="900" filter="url(#sgrain)" />
          </svg>
        </motion.div>

        <motion.div style={{ opacity }} className="relative z-10 text-center max-w-3xl px-6">
          <div className="inline-block glass rounded-full px-4 py-1.5 text-xs text-[color:var(--color-muted)] mb-6">
            Cryptography meets consumer DeFi
          </div>
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            <span className="text-gradient-subtle">Every move,</span>
            <br />
            <span className="text-gradient">mathematically signed.</span>
          </h2>
          <p className="text-[color:var(--color-muted)] mt-6 text-lg max-w-xl mx-auto">
            Not a UI badge. Not a security audit. A 256-byte Groth16 proof that Solana
            itself checks before any of your USDC moves.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

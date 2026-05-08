"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "rise" | "fade" | "slide-left" | "slide-right" | "scale";

const VARIANTS: Record<Variant, { initial: any; whileInView: any }> = {
  rise:        { initial: { opacity: 0, y: 32 },        whileInView: { opacity: 1, y: 0 } },
  fade:        { initial: { opacity: 0 },               whileInView: { opacity: 1 } },
  "slide-left":{ initial: { opacity: 0, x: -48 },       whileInView: { opacity: 1, x: 0 } },
  "slide-right":{initial: { opacity: 0, x: 48 },        whileInView: { opacity: 1, x: 0 } },
  scale:       { initial: { opacity: 0, scale: 0.94 },  whileInView: { opacity: 1, scale: 1 } },
};

export function ScrollReveal({
  children,
  variant = "rise",
  delay = 0,
  duration = 0.7,
  amount = 0.2,
  once = true,
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  amount?: number;
  once?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  const { initial, whileInView } = VARIANTS[variant];
  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={whileInView}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

export function StickySection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0.4]);
  const scale   = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.98]);

  return (
    <section ref={ref} className={`relative h-[200vh] ${className ?? ""}`}>
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div style={{ opacity, scale }} className="w-full">
          {children}
        </motion.div>
      </div>
    </section>
  );
}

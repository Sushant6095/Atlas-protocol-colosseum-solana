// <AnimatedNumber> — odometer-style ramp from prev → next on value
// change. Works with MonoNumber's subscript-decimal rendering by
// emitting a number and letting the parent format it.
//
// Usage:
//   <AnimatedNumber value={tvl} format={(n) => fmtUsd(n)} />
//
// Drives via requestAnimationFrame, easeOutCubic, ~600ms. Honors
// prefers-reduced-motion.

"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";

export interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  format?: (n: number) => ReactNode;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function AnimatedNumberImpl({
  value, durationMs = 600, format, className,
}: AnimatedNumberProps): JSX.Element {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    if (from === value) return;
    startRef.current = null;

    const tick = (now: number): void => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = easeOutCubic(t);
      const next = from + (value - from) * eased;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{format ? format(display) : display.toFixed(2)}</span>;
}

export const AnimatedNumber = memo(AnimatedNumberImpl);

// LiveCounter — animated mono numeric (Phase 22 §1.2).
//
// Numbers tween linearly per Phase 20 §2.5 (no bouncy springs on
// data values). Suspense-friendly: falls back to a placeholder if
// the value is undefined.

"use client";

import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/components/primitives";

export interface LiveCounterProps {
  /** The current value. */
  value: number | undefined;
  /** Format the integer/float when rendering. */
  format?: (n: number) => string;
  label?: string;
  hint?: string;
  className?: string;
  /** Animation duration when value updates. ≤ 400ms. */
  durationMs?: number;
}

function LiveCounterImpl({
  value,
  format,
  label,
  hint,
  className,
  durationMs = 320,
}: LiveCounterProps) {
  const [display, setDisplay] = useState<number>(value ?? 0);
  const startRef = useRef<{ from: number; to: number; t0: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) return;
    startRef.current = { from: display, to: value, t0: performance.now() };
    const tick = () => {
      const s = startRef.current;
      if (!s) return;
      const t = performance.now() - s.t0;
      const k = Math.min(1, t / durationMs);
      const next = s.from + (s.to - s.from) * k;
      setDisplay(next);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const fmt = format ?? defaultFormat;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          {label}
        </span>
      ) : null}
      <span className="font-mono text-[28px] leading-[32px] tracking-tight text-[color:var(--color-ink-primary)]">
        {value == null ? "—" : fmt(display)}
      </span>
      {hint ? (
        <span className="text-[11px] text-[color:var(--color-ink-tertiary)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function defaultFormat(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

export const LiveCounter = memo(LiveCounterImpl);
LiveCounter.displayName = "LiveCounter";

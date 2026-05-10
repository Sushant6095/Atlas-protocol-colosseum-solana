"use client";

import { useEffect, useState } from "react";
import type { KaminoPositionMock } from "@/lib/mocks/positions";

interface KpiTilesProps {
  positions: KaminoPositionMock[];
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

// Lightweight rolling-number tween — RAF-driven, ~600ms ease-out.
function useTween(target: number, durationMs = 600): number {
  const [val, setVal] = useState(target);
  useEffect(() => {
    const from = val;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);
  return val;
}

export function KpiTiles({ positions }: KpiTilesProps) {
  const principal = positions.reduce((s, p) => s + p.principalUsd, 0);
  const current   = positions.reduce((s, p) => s + p.currentUsd, 0);
  const pnl       = current - principal;
  const count     = positions.length;

  const tPrincipal = useTween(principal);
  const tPnl       = useTween(pnl);

  const pnlColor = pnl >= 0 ? "var(--color-accent-execute)" : "var(--color-accent-danger)";
  const pnlSign  = pnl >= 0 ? "+" : "−";

  const tiles = [
    { label: "Total Deposited",  value: fmtUsd(tPrincipal),                       color: "var(--color-ink-primary)" },
    { label: "Unrealized PnL",   value: `${pnlSign}${fmtUsd(Math.abs(tPnl))}`,    color: pnlColor },
    { label: "Active Positions", value: String(count),                            color: "var(--color-accent-zk)" },
  ];

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border md:grid-cols-3"
         style={{
           borderColor: "var(--color-line-medium)",
           background: "var(--color-line-medium)",
         }}>
      {tiles.map((t) => (
        <div
          key={t.label}
          className="p-5"
          style={{ background: "var(--color-surface-raised)" }}
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            {t.label}
          </p>
          <p
            className="mt-2 font-mono text-3xl font-semibold tabular-nums"
            style={{ color: t.color }}
          >
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}

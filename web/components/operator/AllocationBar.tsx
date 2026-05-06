// AllocationBar — horizontal stacked bar for vault allocation
// (Phase 23 §2.2). Strategy-commitment universe rendered as ghost
// segments where allocation is currently 0%. Confidential mode
// hides notionals; ratios still render.

"use client";

import { memo } from "react";
import { cn } from "@/components/primitives";

export interface AllocationLeg {
  protocol: string;
  asset: string;
  bps: number;        // 0..=10_000
  notional_q64?: bigint | string;  // omitted in confidential mode for non-FA
  /** True iff the leg is in the vault's strategy-commitment universe. */
  in_universe: boolean;
  color?: string;
}

interface AllocationBarProps {
  legs: AllocationLeg[];
  showNotional?: boolean;
}

const PALETTE = ["#3F8CFF", "#A682FF", "#F478C6", "#3CE39A", "#F7B955", "#7DB7FF"];

function AllocationBarImpl({ legs, showNotional }: AllocationBarProps) {
  const allocated = legs.filter((l) => l.bps > 0);
  const total = allocated.reduce((a, l) => a + l.bps, 0);
  const idle = Math.max(0, 10_000 - total);
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-[var(--radius-xs)] overflow-hidden bg-[color:var(--color-line-medium)]">
        {allocated.map((l, i) => (
          <span
            key={`${l.protocol}-${l.asset}`}
            title={`${l.protocol} · ${l.asset} · ${(l.bps / 100).toFixed(2)}%`}
            style={{
              width: `${l.bps / 100}%`,
              background: l.color ?? PALETTE[i % PALETTE.length],
            }}
          />
        ))}
        {idle > 0 ? (
          <span
            title={`idle · ${(idle / 100).toFixed(2)}%`}
            className="bg-[color:var(--color-line-strong)]/40"
            style={{ width: `${idle / 100}%` }}
          />
        ) : null}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[12px]">
        {legs.map((l, i) => (
          <li key={`${l.protocol}-${l.asset}-row`}
              className={cn(
                "flex items-center justify-between gap-3",
                !l.in_universe && "opacity-40",
              )}>
            <span className="inline-flex items-center gap-2 truncate">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: l.color ?? PALETTE[i % PALETTE.length] }}
              />
              <span className="text-[color:var(--color-ink-primary)] truncate">
                {l.protocol}
              </span>
              <span className="text-[color:var(--color-ink-tertiary)]">{l.asset}</span>
            </span>
            <span className="flex items-center gap-3">
              {showNotional && l.notional_q64 != null ? (
                <span className="text-[color:var(--color-ink-tertiary)]">
                  ${fmtNotional(l.notional_q64)}
                </span>
              ) : null}
              <span className="text-[color:var(--color-ink-secondary)] tabular-nums">
                {(l.bps / 100).toFixed(2)}%
              </span>
            </span>
          </li>
        ))}
        {idle > 0 ? (
          <li className="flex items-center justify-between gap-3 col-span-full">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-line-strong)]" />
              <span className="text-[color:var(--color-ink-tertiary)]">idle buffer</span>
            </span>
            <span className="text-[color:var(--color-ink-secondary)] tabular-nums">
              {(idle / 100).toFixed(2)}%
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function fmtNotional(v: bigint | string): string {
  const n = typeof v === "string" ? Number(v) : Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export const AllocationBar = memo(AllocationBarImpl);
AllocationBar.displayName = "AllocationBar";

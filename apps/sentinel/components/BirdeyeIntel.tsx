"use client";

import { Activity } from "lucide-react";
import { BIRDEYE_LIVE } from "@/lib/env";
import { MOCK_TOKEN_STATS, MOCK_WHALES } from "@/lib/mocks/anomalies";

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function BirdeyeIntel() {
  // Phase 1: when BIRDEYE_LIVE is true, swap mocks for SWR fetches to
  //   /defi/price + /defi/txs/largest, refreshing every 30s.
  const tokens = MOCK_TOKEN_STATS;
  const whales = MOCK_WHALES;

  return (
    <aside
      className="rounded-xl border p-5"
      style={{
        borderColor: "var(--color-line-medium)",
        background: "var(--color-surface-raised)",
      }}
    >
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Activity className="h-4 w-4" style={{ color: "var(--color-accent-zk)" }} />
          Market Intelligence
        </h3>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: BIRDEYE_LIVE ? "var(--color-accent-execute)" : "var(--color-ink-tertiary)" }}
        >
          {BIRDEYE_LIVE ? "live" : "fixture"}
        </span>
      </header>

      <p
        className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]"
        style={{ color: "var(--color-ink-tertiary)" }}
      >
        Birdeye · refresh 30s
      </p>

      {/* Token stats */}
      <ul className="mt-5 flex flex-col gap-3">
        {tokens.map((t) => {
          const positive = t.change24hPct >= 0;
          return (
            <li
              key={t.symbol}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold">{t.symbol}</span>
                {t.volumeAnomaly && (
                  <span
                    className="anomaly-pulse inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
                    style={{
                      background: "color-mix(in oklab, var(--color-accent-warn) 14%, transparent)",
                      color: "var(--color-accent-warn)",
                      border: "1px solid color-mix(in oklab, var(--color-accent-warn) 35%, transparent)",
                    }}
                  >
                    Vol ↑
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-mono text-xs tabular-nums">${t.priceUsd.toFixed(t.priceUsd < 10 ? 3 : 2)}</span>
                <span
                  className="ml-2 font-mono text-[10px] tabular-nums"
                  style={{ color: positive ? "var(--color-accent-execute)" : "var(--color-accent-danger)" }}
                >
                  {positive ? "+" : ""}
                  {t.change24hPct.toFixed(2)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="my-5 h-px" style={{ background: "var(--color-line-soft)" }} />

      {/* Whale ticker */}
      <p
        className="font-mono text-[10px] uppercase tracking-[0.14em] mb-3"
        style={{ color: "var(--color-ink-tertiary)" }}
      >
        Whale txs · 24h
      </p>
      <ul className="flex flex-col gap-2">
        {whales.map((w, i) => (
          <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
            <span
              className="inline-flex items-center gap-1.5"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: w.side === "BUY" ? "var(--color-accent-execute)" : "var(--color-accent-danger)" }}
              />
              {w.token} · {w.side}
            </span>
            <span style={{ color: "var(--color-ink-primary)" }}>{fmtUsd(w.usd)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

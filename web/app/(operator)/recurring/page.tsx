// /recurring — Adaptive DCA plans (Phase 23 §10).

"use client";

import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Sparkline } from "@/components/operator";

interface Plan {
  vault: string;
  asset: string;
  slice_q64: number;
  interval_slots: number;
  slippage_bps: number;
  paused: boolean;
  recent_sizes: number[];
  cadence_history: { slot: number; proof_hash: string; change: string }[];
}

const PLANS: Plan[] = [
  {
    vault: "ab12cdef" + "0".repeat(56), asset: "USDC → kSOL",
    slice_q64: 12_500, interval_slots: 24_000, slippage_bps: 35, paused: false,
    recent_sizes: [12, 13, 12, 14, 14, 13, 12, 15, 14, 12, 13, 12],
    cadence_history: [
      { slot: 245_002_000, proof_hash: "0xa1" + "0".repeat(62), change: "interval 24_000 ← 28_800" },
      { slot: 244_961_000, proof_hash: "0xa2" + "0".repeat(62), change: "slice +8% (volatility regime tighter)" },
      { slot: 244_900_000, proof_hash: "0xa3" + "0".repeat(62), change: "slippage 35 bps ← 50 bps (depth recovered)" },
    ],
  },
  {
    vault: "01a02b03" + "0".repeat(56), asset: "USDC → JLP",
    slice_q64: 5_000, interval_slots: 12_000, slippage_bps: 50, paused: true,
    recent_sizes: [5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    cadence_history: [
      { slot: 244_999_000, proof_hash: "0xa4" + "0".repeat(62), change: "paused (regime crisis)" },
    ],
  },
];

export default function Page() {
  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            phase 12 · adaptive recurring
          </p>
          <h1 className="text-display text-[20px] mt-1">Recurring plans</h1>
        </div>
        <Link href="/recurring/new"><Button variant="primary" size="sm">New plan</Button></Link>
      </header>

      <div className="space-y-3">
        {PLANS.map((p) => (
          <Panel key={p.vault} surface="raised" density="dense">
            <header className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <IdentifierMono value={p.vault} size="xs" />
                <span className="font-mono text-[13px] text-[color:var(--color-ink-primary)]">{p.asset}</span>
                {p.paused
                  ? <AlertPill severity="warn">paused</AlertPill>
                  : <AlertPill severity="execute">active</AlertPill>}
              </div>
              <Sparkline values={p.recent_sizes} stroke="var(--color-accent-electric)" fill="var(--color-accent-electric)" height={28} width={240} />
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">parameters</p>
                <ul className="mt-2 font-mono text-[11px] space-y-1 text-[color:var(--color-ink-secondary)]">
                  <li>slice · {p.slice_q64.toLocaleString()} Q64</li>
                  <li>interval · {p.interval_slots.toLocaleString()} slots ({(p.interval_slots * 0.4 / 60).toFixed(0)} min)</li>
                  <li>slippage · {p.slippage_bps} bps</li>
                </ul>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">cadence history · each change is proof-gated</p>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {p.cadence_history.map((c) => (
                    <li key={c.proof_hash} className="grid grid-cols-12 gap-3 items-center">
                      <span className="col-span-3 text-[color:var(--color-ink-tertiary)]">{c.slot.toLocaleString()}</span>
                      <span className="col-span-6 text-[color:var(--color-ink-secondary)]">{c.change}</span>
                      <span className="col-span-3 text-right">
                        <IdentifierMono value={c.proof_hash} size="xs" />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

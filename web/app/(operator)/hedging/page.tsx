// /hedging — Optional treasury hedging (Phase 23 §11).

"use client";

import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { Tile } from "@/components/primitives/Tile";
import { AlertPill } from "@/components/primitives/AlertPill";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";

const RESIZES = [
  { slot: 245_002_400, change: "+12.0% notional · regime drift", proof: "0xc1" + "0".repeat(62) },
  { slot: 244_900_000, change: "−8.0% notional · vol regime tighter", proof: "0xc2" + "0".repeat(62) },
  { slot: 244_840_000, change: "open · 32% of LP exposure", proof: "0xc3" + "0".repeat(62) },
];

export default function Page() {
  return (
    <div className="px-4 py-4 space-y-3">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          phase 12 · optional treasury hedge
        </p>
        <h1 className="text-display text-[20px] mt-1">Hedging</h1>
      </header>

      <Panel surface="raised" density="dense" accent="warn">
        <div className="flex items-center gap-3 flex-wrap">
          <AlertPill severity="warn">opt-in</AlertPill>
          <p className="text-[12px] text-[color:var(--color-ink-secondary)]">
            Adds counterparty risk via Jupiter Perps. Disabled by default. Open / close / resize is proof-gated.
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              current position
            </p>
          </header>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Tile label="notional"      value="$420k" mono accent="warn" />
            <Tile label="leverage"      value="1.8×"  mono />
            <Tile label="liquidation Δ" value="22.0%" mono />
            <Tile label="funding 24h"   value="−0.06%" mono />
            <Tile label="LP coverage"   value="32%" mono />
            <Tile label="slippage"      value="40 bps" mono />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary"     size="sm">Resize</Button>
            <Button variant="secondary"   size="sm">Close</Button>
            <Button variant="ghost"       size="sm">Pause</Button>
          </div>
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              recent resizes · proof-gated
            </p>
          </header>
          <ul className="space-y-2 font-mono text-[11px]">
            {RESIZES.map((r) => (
              <li key={r.proof} className="grid grid-cols-12 gap-3 items-center border-t border-[color:var(--color-line-soft)] pt-2 first:border-0 first:pt-0">
                <span className="col-span-3 text-[color:var(--color-ink-tertiary)]">{r.slot.toLocaleString()}</span>
                <span className="col-span-6 text-[color:var(--color-ink-secondary)]">{r.change}</span>
                <span className="col-span-3 text-right">
                  <IdentifierMono value={r.proof} size="xs" />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

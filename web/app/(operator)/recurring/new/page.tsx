// /recurring/new — Adaptive DCA wizard (Phase 23 §10).

"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";

export default function Page() {
  const [pair, setPair]           = useState("USDC → kSOL");
  const [slice, setSlice]         = useState("12500");
  const [interval, setInterval_]  = useState("24000");
  const [slippage, setSlippage]   = useState("35");
  const [maxDecay, setMaxDecay]   = useState("60");

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            new recurring plan · adaptive DCA
          </p>
          <h1 className="text-display text-[20px] mt-1">Recurring</h1>
        </div>
        <Link href="/recurring"><Button variant="ghost" size="sm">← back</Button></Link>
      </header>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 md:col-span-7 space-y-3">
          <Field label="pair" value={pair} onChange={setPair} />
          <Field label="slice (Q64)" value={slice} onChange={setSlice} />
          <Field label="interval (slots)" value={interval} onChange={setInterval_} />
          <Field label="slippage budget (bps)" value={slippage} onChange={setSlippage} />
          <Field label="max APY decay before pause (bps)" value={maxDecay} onChange={setMaxDecay} />
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 md:col-span-5">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              policy bounds · what the AI is allowed to modulate
            </p>
          </header>
          <ul className="space-y-2 font-mono text-[11px] text-[color:var(--color-ink-secondary)]">
            <li>· slice ± 30% of base · proof-gated</li>
            <li>· interval ∈ [base × 0.5, base × 2.0]</li>
            <li>· slippage ≤ {slippage} bps</li>
            <li>· auto-pause if APY decay {maxDecay}+ bps over 14d</li>
            <li>· auto-pause on regime ∈ {`{`}defensive, crisis{`}`}</li>
          </ul>
          <div className="mt-4 pt-3 border-t border-[color:var(--color-line-soft)]">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              strategy_commitment
            </p>
            <IdentifierMono value={"0xa1b2" + "0".repeat(60)} copy size="sm" />
            <AlertPill severity="ok" className="mt-3">within bounds</AlertPill>
          </div>
          <div className="mt-3">
            <Button variant="primary" size="md">Sign + create</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-3 font-mono text-[12px] outline-none focus:border-[color:var(--color-accent-electric)]"
      />
    </label>
  );
}

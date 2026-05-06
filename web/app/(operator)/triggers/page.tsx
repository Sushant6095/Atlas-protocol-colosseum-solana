// /triggers — proof-gated Jupiter trigger orders (Phase 23 §9.1).

"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { cn } from "@/components/primitives";

type TriggerType = "StopLoss" | "TakeProfit" | "Oco" | "RegimeExit" | "LpExitOnDepthCollapse";

interface TriggerRow {
  id: string;
  type: TriggerType;
  vault: string;
  conditions_summary: string;
  conditions_hash: string;
  valid_until_slot: number;
  status: "active" | "fired" | "expired" | "rejected";
  last_check: { slot: number; result: "pass" | "reject" };
}

const TRIGGERS: TriggerRow[] = [
  { id: "trg-001", type: "StopLoss",    vault: "ab12cdef" + "0".repeat(56), conditions_summary: "kSOL ≤ $128 AND oracle_fresh AND regime ≠ crisis", conditions_hash: "0xb1" + "0".repeat(62), valid_until_slot: 245_120_000, status: "active", last_check: { slot: 245_002_980, result: "pass" } },
  { id: "trg-002", type: "TakeProfit",  vault: "ab12cdef" + "0".repeat(56), conditions_summary: "kSOL ≥ $164 AND oracle_fresh",                       conditions_hash: "0xb2" + "0".repeat(62), valid_until_slot: 245_240_000, status: "active", last_check: { slot: 245_002_980, result: "pass" } },
  { id: "trg-003", type: "Oco",         vault: "01a02b03" + "0".repeat(56), conditions_summary: "USDC ≤ $0.995 OR USDC ≥ $1.005",                     conditions_hash: "0xb3" + "0".repeat(62), valid_until_slot: 245_080_000, status: "active", last_check: { slot: 245_002_980, result: "pass" } },
  { id: "trg-004", type: "RegimeExit",  vault: "ff10ee20" + "0".repeat(56), conditions_summary: "regime = crisis",                                    conditions_hash: "0xb4" + "0".repeat(62), valid_until_slot: 245_080_000, status: "fired",  last_check: { slot: 245_002_400, result: "pass" } },
  { id: "trg-005", type: "LpExitOnDepthCollapse", vault: "deadbeef" + "0".repeat(56), conditions_summary: "depth-1pct < 0.6× rebalance_notional",      conditions_hash: "0xb5" + "0".repeat(62), valid_until_slot: 245_180_000, status: "active", last_check: { slot: 245_002_980, result: "pass" } },
];

export default function Page() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            phase 12 · proof-gated triggers
          </p>
          <h1 className="text-display text-[20px] mt-1">Triggers</h1>
        </div>
        <Link href="/triggers/new"><Button variant="primary" size="sm">New trigger</Button></Link>
      </header>

      <Panel surface="raised" density="dense">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-2 pr-2">id</th>
              <th className="py-2 pr-2">type</th>
              <th className="py-2 pr-2">vault</th>
              <th className="py-2 pr-2">conditions</th>
              <th className="py-2 pr-2">valid until</th>
              <th className="py-2 pr-2">status</th>
              <th className="py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {TRIGGERS.map((t) => (
              <RowAndDetail key={t.id} row={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function RowAndDetail({ row, open, onToggle }: { row: TriggerRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={cn("border-t border-[color:var(--color-line-soft)]", open && "bg-[color:var(--color-line-soft)]")}
          onClick={onToggle}>
        <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{row.id}</td>
        <td className="py-1.5 pr-2">{row.type}</td>
        <td className="py-1.5 pr-2"><IdentifierMono value={row.vault} size="xs" /></td>
        <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)] truncate">{row.conditions_summary}</td>
        <td className="py-1.5 pr-2">{row.valid_until_slot.toLocaleString()}</td>
        <td className="py-1.5 pr-2">
          {row.status === "active"   ? <AlertPill severity="execute">active</AlertPill>
        :  row.status === "fired"    ? <AlertPill severity="info">fired</AlertPill>
        :  row.status === "expired"  ? <AlertPill severity="muted">expired</AlertPill>
        :                              <AlertPill severity="danger">rejected</AlertPill>}
        </td>
        <td className="py-1.5 text-right">
          <Button variant="ghost" size="sm">{open ? "− close" : "+ details"}</Button>
        </td>
      </tr>
      {open ? (
        <tr className="bg-[color:var(--color-surface-base)]">
          <td colSpan={7} className="px-3 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">conditions</p>
                <p className="text-[12px] text-[color:var(--color-ink-secondary)] mt-1">{row.conditions_summary}</p>
                <p className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                  conditions_hash · <IdentifierMono value={row.conditions_hash} size="xs" copy />
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">recent gate-checks</p>
                <ul className="mt-1 space-y-1 font-mono text-[11px]">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const slot = row.last_check.slot - i * 480;
                    const result = i === 1 && row.status === "rejected" ? "reject" : "pass";
                    return (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="text-[color:var(--color-ink-tertiary)]">{slot.toLocaleString()}</span>
                        <AlertPill severity={result === "pass" ? "execute" : "danger"}>{result}</AlertPill>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

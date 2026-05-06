// /treasury/[id]/payments — Payments schedule (Phase 23 §8.7).

"use client";

import { use } from "react";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill, type AlertSeverity } from "@/components/primitives/AlertPill";

type Status = "scheduled" | "pre_warming" | "settling" | "settled" | "failed";

interface Row {
  id: string;
  counterparty: string;
  amount_usd: number;
  mint: "USDC" | "PYUSD" | "PUSD";
  status: Status;
  schedule_slot: number;
  receipt: string;
}

const ROWS: Row[] = [
  { id: "pay-001", counterparty: "Payroll · 12 employees", amount_usd: 86_000, mint: "PUSD",  status: "pre_warming", schedule_slot: 245_080_000, receipt: "0xa1" + "0".repeat(62) },
  { id: "pay-002", counterparty: "AWS",                     amount_usd: 28_000, mint: "USDC",  status: "scheduled",   schedule_slot: 245_120_000, receipt: "0xa2" + "0".repeat(62) },
  { id: "pay-003", counterparty: "Audit firm",              amount_usd:  4_200, mint: "USDC",  status: "settling",    schedule_slot: 245_002_980, receipt: "0xa3" + "0".repeat(62) },
  { id: "pay-004", counterparty: "ACME GmbH",               amount_usd: 18_400, mint: "USDC",  status: "settled",     schedule_slot: 245_002_400, receipt: "0xa4" + "0".repeat(62) },
  { id: "pay-005", counterparty: "Hosting · Vercel",        amount_usd:    240, mint: "USDC",  status: "failed",      schedule_slot: 245_002_400, receipt: "0xa5" + "0".repeat(62) },
];

const SEV: Record<Status, AlertSeverity> = {
  scheduled:    "info",
  pre_warming:  "warn",
  settling:     "warn",
  settled:      "execute",
  failed:       "danger",
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="px-4 py-4 space-y-3">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">payments · phase 13</p>
        <div className="flex items-center gap-2 mt-1">
          <h1 className="text-display text-[20px]">Payments</h1>
          <IdentifierMono value={id} size="sm" />
        </div>
      </header>

      <Panel surface="raised" density="dense">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-2 pr-2">id</th>
              <th className="py-2 pr-2">counterparty</th>
              <th className="py-2 pr-2 text-right">amount</th>
              <th className="py-2 pr-2">mint</th>
              <th className="py-2 pr-2">schedule slot</th>
              <th className="py-2 pr-2">status</th>
              <th className="py-2 pr-2">receipt</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--color-line-soft)]">
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.id}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-primary)]">{r.counterparty}</td>
                <td className="py-1.5 pr-2 text-right">${r.amount_usd.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-tertiary)]">{r.mint}</td>
                <td className="py-1.5 pr-2">{r.schedule_slot.toLocaleString()}</td>
                <td className="py-1.5 pr-2"><AlertPill severity={SEV[r.status]}>{r.status.replace("_", " ")}</AlertPill></td>
                <td className="py-1.5 pr-2"><IdentifierMono value={r.receipt} size="xs" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

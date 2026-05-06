// /treasury/[id]/ledger — Unified ledger (Phase 23 §8.4).

"use client";

import { use, useMemo, useState } from "react";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { cn } from "@/components/primitives";
import { VerifyInBrowser, type ProofShape } from "@/components/proofs/VerifyInBrowser";

type EventType = "deposit" | "rebalance" | "payout" | "pre-warm" | "invoice" | "withdrawal";

interface Row {
  slot: number;
  ts_iso: string;
  type: EventType;
  counterparty: string;
  amount_usd: number;
  status: "verified" | "pending" | "failed";
  proof_hash: string;
}

const SAMPLE_PROOF: ProofShape = {
  publicInputHex: "00".repeat(268),
  proofBytes: Array.from({ length: 256 }, (_, i) => i & 0xff),
  archiveRootSlot: 245_000_000,
  archiveRoot: "a1".repeat(32),
  merkleProofPath: ["b2".repeat(32), "c3".repeat(32), "d4".repeat(32)],
};

const TYPES: EventType[] = ["deposit", "rebalance", "payout", "pre-warm", "invoice", "withdrawal"];

function makeRows(n: number): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < n; i++) {
    const type = TYPES[i % TYPES.length];
    out.push({
      slot: 245_002_400 - i * 480,
      ts_iso: new Date(Date.now() - i * 240_000).toISOString().slice(0, 19).replace("T", " "),
      type,
      counterparty: ["ACME GmbH", "Drift", "Kamino", "9P3...x1Ka", "Audit firm", "Payroll", "Marginfi"][i % 7],
      amount_usd: type === "deposit" ? 24_000 + i * 60 : type === "payout" ? 4_200 + i * 80 : 18_000 + i * 70,
      status: i % 11 === 10 ? "failed" : i % 9 === 8 ? "pending" : "verified",
      proof_hash: ["a1b2c3d4", "e5f60718", "9081a2b3"][i % 3] + i.toString(16).padStart(56, "0"),
    });
  }
  return out;
}

const ALL = makeRows(40);

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const rows = useMemo(() => filter === "all" ? ALL : ALL.filter((r) => r.type === filter), [filter]);

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            unified ledger · deposits · rebalances · payouts · invoices · pre-warms
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-display text-[20px]">Ledger</h1>
            <IdentifierMono value={id} size="sm" />
          </div>
        </div>
        <div className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
          {rows.length} events · {ALL.length} total
        </div>
      </header>

      <Panel surface="raised" density="dense">
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {(["all", ...TYPES] as const).map((t) => (
            <button key={t} onClick={() => setFilter(t)}
                    className={cn(
                      "px-2 h-6 rounded-[var(--radius-sm)] text-[11px] font-mono",
                      filter === t
                        ? "bg-[color:var(--color-line-soft)] text-[color:var(--color-ink-primary)]"
                        : "text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-line-soft)]",
                    )}>
              {t}
            </button>
          ))}
        </div>

        <table className="w-full font-mono text-[11px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-2 pr-2">slot</th>
              <th className="py-2 pr-2">timestamp</th>
              <th className="py-2 pr-2">type</th>
              <th className="py-2 pr-2">counterparty</th>
              <th className="py-2 pr-2 text-right">amount</th>
              <th className="py-2 pr-2">status</th>
              <th className="py-2 pr-2">proof / receipt</th>
              <th className="py-2 text-right">verify</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.proof_hash} className="border-t border-[color:var(--color-line-soft)] hover:bg-[color:var(--color-line-soft)]">
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.slot.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-tertiary)]">{r.ts_iso}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-primary)]">{r.type}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.counterparty}</td>
                <td className="py-1.5 pr-2 text-right">${r.amount_usd.toLocaleString()}</td>
                <td className="py-1.5 pr-2">
                  {r.status === "verified" ? <AlertPill severity="execute">verified</AlertPill>
                 : r.status === "pending"  ? <AlertPill severity="warn">pending</AlertPill>
                 :                            <AlertPill severity="danger">failed</AlertPill>}
                </td>
                <td className="py-1.5 pr-2"><IdentifierMono value={r.proof_hash} size="xs" /></td>
                <td className="py-1.5 text-right">
                  <VerifyInBrowser proof={SAMPLE_PROOF} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

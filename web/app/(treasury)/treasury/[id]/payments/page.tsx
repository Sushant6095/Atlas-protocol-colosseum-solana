// /treasury/[id]/payments — Payments schedule + Dodo Payments
// integration surface.

"use client";

import { use, useState } from "react";
import { Check, Webhook, Zap } from "lucide-react";
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

interface DodoReceipt {
  id: string;
  intent: string;
  amount_usd: number;
  mint: "USDC" | "PYUSD";
  signed_at: string;
  hmac: string;
  prewarm_pct: number;
  verified: boolean;
}

const ROWS: Row[] = [
  { id: "pay-001", counterparty: "Payroll · 12 employees", amount_usd: 86_000, mint: "PUSD",  status: "pre_warming", schedule_slot: 245_080_000, receipt: "0xa1" + "0".repeat(62) },
  { id: "pay-002", counterparty: "AWS",                     amount_usd: 28_000, mint: "USDC",  status: "scheduled",   schedule_slot: 245_120_000, receipt: "0xa2" + "0".repeat(62) },
  { id: "pay-003", counterparty: "Audit firm",              amount_usd:  4_200, mint: "USDC",  status: "settling",    schedule_slot: 245_002_980, receipt: "0xa3" + "0".repeat(62) },
  { id: "pay-004", counterparty: "ACME GmbH",               amount_usd: 18_400, mint: "USDC",  status: "settled",     schedule_slot: 245_002_400, receipt: "0xa4" + "0".repeat(62) },
  { id: "pay-005", counterparty: "Hosting · Vercel",        amount_usd:    240, mint: "USDC",  status: "failed",      schedule_slot: 245_002_400, receipt: "0xa5" + "0".repeat(62) },
];

const DODO_RECEIPTS: DodoReceipt[] = [
  { id: "dodo-001", intent: "payroll.batch.2026-05",    amount_usd: 86_000, mint: "PUSD", signed_at: "12m ago", hmac: "9f3b2c…0a1d", prewarm_pct: 100, verified: true },
  { id: "dodo-002", intent: "invoice.aws.may-2026",     amount_usd: 28_000, mint: "USDC", signed_at: "1h ago",  hmac: "4e8a17…ff20", prewarm_pct: 100, verified: true },
  { id: "dodo-003", intent: "invoice.audit.q2",         amount_usd:  4_200, mint: "USDC", signed_at: "3h ago",  hmac: "b7c2e1…44e8", prewarm_pct: 100, verified: true },
  { id: "dodo-004", intent: "vendor.acme-gmbh.0512",    amount_usd: 18_400, mint: "USDC", signed_at: "9h ago",  hmac: "2d9f4a…918c", prewarm_pct: 100, verified: true },
  { id: "dodo-005", intent: "saas.vercel.may",          amount_usd:    240, mint: "USDC", signed_at: "1d ago",  hmac: "6c0b3e…7712", prewarm_pct: 100, verified: false },
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
  const [simulating, setSimulating] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [prewarmPct, setPrewarmPct] = useState(78);

  function simulateInvoice() {
    setSimulating(true);
    setSimulated(false);
    // Animate pre-warm bar from current → 100 over ~2s, then mark
    // settled. This is the literal trigger demo-moment #3 records.
    const startPct = prewarmPct;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 2000);
      const eased = 1 - Math.pow(1 - t, 3);
      setPrewarmPct(startPct + (100 - startPct) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else {
        setSimulating(false);
        setSimulated(true);
        setTimeout(() => {
          setSimulated(false);
          setPrewarmPct(78);
        }, 4000);
      }
    };
    requestAnimationFrame(tick);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          payments
        </p>
        <div className="flex items-center gap-2 mt-1">
          <h1 className="text-display text-[20px]">Payments</h1>
          <IdentifierMono value={id} size="sm" />
        </div>
      </header>

      {/* ── Dodo Payments connection block ─────────────────────── */}
      <Panel surface="raised" density="dense">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]"
                style={{
                  background: "color-mix(in oklab, var(--color-accent-execute) 12%, transparent)",
                  color: "var(--color-accent-execute)",
                  border: "1px solid color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
                }}
              >
                <Check className="h-3 w-3" /> Connected · Dodo Payments
              </span>
              <a
                href="/docs/integrations/dodo"
                className="font-mono text-[11px] hover:opacity-80"
                style={{ color: "var(--color-accent-zk)" }}
              >
                view integration →
              </a>
            </div>
            <button
              type="button"
              onClick={simulateInvoice}
              disabled={simulating}
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-line-strong)] disabled:opacity-60"
              style={{
                borderColor: "var(--color-line-medium)",
                background: "var(--color-surface-base)",
                color: simulating
                  ? "var(--color-accent-warn)"
                  : "var(--color-accent-electric)",
              }}
            >
              {simulating ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: "currentColor", borderRightColor: "currentColor" }} />
              ) : simulated ? (
                <Check className="h-3 w-3" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              {simulating ? "pre-warming…" : simulated ? "settled" : "Simulate Dodo invoice"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-[var(--radius-md)] overflow-hidden border"
               style={{ borderColor: "var(--color-line-soft)", background: "var(--color-line-soft)" }}>
            <StatCell
              label="pending webhooks"
              value="2"
              hint="awaiting HMAC reconcile"
              color="var(--color-accent-warn)"
            />
            <StatCell
              label="next payout"
              value="$50,000 USDC"
              hint="in 4h"
              color="var(--color-ink-primary)"
            />
            <StatCell
              label="pre-warm"
              value={`${prewarmPct.toFixed(0)}%`}
              hint={prewarmPct >= 100 ? "settled ✓" : "schedule live"}
              color={prewarmPct >= 100 ? "var(--color-accent-execute)" : "var(--color-accent-electric)"}
              bar={prewarmPct}
            />
          </div>
        </div>
      </Panel>

      {/* ── Dodo webhook receipts ──────────────────────────────── */}
      <Panel surface="raised" density="dense">
        <header className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-tertiary)]">
            recent Dodo webhook receipts
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: "var(--color-ink-tertiary)" }}>
            <Webhook className="h-3 w-3" /> HMAC verified
          </span>
        </header>
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-2 pr-2">id</th>
              <th className="py-2 pr-2">intent</th>
              <th className="py-2 pr-2 text-right">amount</th>
              <th className="py-2 pr-2">mint</th>
              <th className="py-2 pr-2">signed</th>
              <th className="py-2 pr-2">hmac</th>
              <th className="py-2 pr-2">status</th>
            </tr>
          </thead>
          <tbody>
            {DODO_RECEIPTS.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--color-line-soft)]">
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.id}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-primary)]">{r.intent}</td>
                <td className="py-1.5 pr-2 text-right">${r.amount_usd.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-tertiary)]">{r.mint}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-tertiary)]">{r.signed_at}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-accent-zk)]">{r.hmac}</td>
                <td className="py-1.5 pr-2">
                  <AlertPill severity={r.verified ? "execute" : "warn"}>
                    {r.verified ? "verified" : "retry"}
                  </AlertPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* ── Existing payments schedule ─────────────────────────── */}
      <Panel surface="raised" density="dense">
        <header className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-tertiary)]">
            scheduled payouts
          </span>
        </header>
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

function StatCell({
  label, value, hint, color, bar,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  bar?: number;
}) {
  return (
    <div className="px-4 py-3" style={{ background: "var(--color-surface-raised)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em]"
         style={{ color: "var(--color-ink-tertiary)" }}>
        {label}
      </p>
      <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--color-ink-tertiary)" }}>
        {hint}
      </p>
      {typeof bar === "number" && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full"
             style={{ background: "var(--color-surface-sunken)" }}>
          <div className="h-full rounded-full transition-[width] duration-200"
               style={{ width: `${Math.min(100, bar)}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

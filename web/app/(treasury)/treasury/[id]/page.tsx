// /treasury/[id] — Treasury overview (Phase 23 §8.3).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Button } from "@/components/primitives/Button";
import { AllocationBar, Sparkline, type AllocationLeg } from "@/components/operator";

const ALLOCATION: AllocationLeg[] = [
  { protocol: "Kamino",   asset: "USDC", bps: 4_500, in_universe: true,  notional_q64: "3753000" },
  { protocol: "Drift",    asset: "kSOL", bps: 1_600, in_universe: true,  notional_q64: "1334000" },
  { protocol: "Marginfi", asset: "USDC", bps: 1_500, in_universe: true,  notional_q64: "1251000" },
  { protocol: "Jupiter",  asset: "JLP",  bps:   900, in_universe: true,  notional_q64: "751000"  },
];

const PAYOUTS_NEXT_7D = [
  { date: "in 1d", counterparty: "ACME GmbH",        mint: "USDC", amount_usd: 12_400 },
  { date: "in 2d", counterparty: "Audit firm",       mint: "USDC", amount_usd:  4_200 },
  { date: "in 4d", counterparty: "Hosting · AWS",    mint: "USDC", amount_usd: 28_000 },
  { date: "in 6d", counterparty: "Payroll",          mint: "PUSD", amount_usd: 86_000 },
];

const RECENT_LEDGER = [
  { ts: "−1m",  type: "rebalance", text: "+12.0% Kamino · −8.0% Drift",          status: "verified" as const },
  { ts: "−14m", type: "deposit",   text: "+ $24,000 USDC from 9P3...x1Ka",        status: "verified" as const },
  { ts: "−2h",  type: "payout",    text: "− $4,200 USDC → audit firm",            status: "verified" as const },
  { ts: "−6h",  type: "invoice",   text: "$18,400 invoice settled (ACME GmbH)",   status: "verified" as const },
  { ts: "−1d",  type: "pre-warm",  text: "+ $30,000 USDC moved to idle (payroll)", status: "verified" as const },
];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            treasury overview · multisig
          </p>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-display text-[24px]">Atlas Labs</h1>
            <AlertPill severity="info">Business</AlertPill>
            <IdentifierMono value={id} copy size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/treasury/${id}/ledger`}><Button variant="primary" size="sm">Open ledger <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Panel surface="raised" density="dense"><Tile label="tvl"          value="$8.34M" mono accent="execute" /></Panel>
        <Panel surface="raised" density="dense"><Tile label="runway p10"   value="142d"   mono accent="execute" /></Panel>
        <Panel surface="raised" density="dense"><Tile label="runway p50"   value="186d"   mono /></Panel>
        <Panel surface="raised" density="dense"><Tile label="open alerts"  value={0}      mono /></Panel>
        <Panel surface="raised" density="dense"><Tile label="pending sigs" value={1}      mono accent="warn" /></Panel>
        <Panel surface="raised" density="dense"><Tile label="last rebal"   value="12s"    mono /></Panel>
      </div>

      {/* Allocation + cashflow */}
      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              allocation · across all vaults under this treasury
            </p>
          </header>
          <AllocationBar legs={ALLOCATION} showNotional />
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              cashflow · next 30d
            </p>
          </header>
          <Sparkline values={[8.34, 8.42, 8.34, 8.18, 8.20, 8.05, 8.0, 7.91, 7.83, 7.78]}
                     stroke="var(--color-accent-electric)" fill="var(--color-accent-electric)"
                     height={64} width={420} />
          <div className="mt-3 grid grid-cols-3 gap-3 text-[12px] font-mono">
            <Tile label="inflows"  value="$92k"  accent="execute" mono />
            <Tile label="outflows" value="$478k" accent="warn"    mono />
            <Tile label="net"      value="−$386k"                  mono />
          </div>
        </Panel>
      </div>

      {/* Pending payouts + recent ledger */}
      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-6">
          <header className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              upcoming payouts · 7d
            </p>
            <Link href={`/treasury/${id}/payments`} className="text-[11px] text-[color:var(--color-accent-electric)] hover:underline">
              all payments →
            </Link>
          </header>
          <table className="w-full font-mono text-[12px]">
            <tbody>
              {PAYOUTS_NEXT_7D.map((p) => (
                <tr key={p.counterparty + p.date} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5 text-[color:var(--color-ink-tertiary)]">{p.date}</td>
                  <td className="py-1.5">{p.counterparty}</td>
                  <td className="py-1.5 text-[color:var(--color-ink-secondary)]">{p.mint}</td>
                  <td className="py-1.5 text-right">${p.amount_usd.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-6">
          <header className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              recent activity · ledger
            </p>
            <Link href={`/treasury/${id}/ledger`} className="text-[11px] text-[color:var(--color-accent-electric)] hover:underline">
              full ledger →
            </Link>
          </header>
          <ul className="divide-y divide-[color:var(--color-line-soft)] text-[12px] font-mono">
            {RECENT_LEDGER.map((l, i) => (
              <li key={i} className="py-2 grid grid-cols-12 gap-2 items-center">
                <span className="col-span-1 text-[color:var(--color-ink-tertiary)]">{l.ts}</span>
                <span className="col-span-2 text-[color:var(--color-ink-secondary)]">{l.type}</span>
                <span className="col-span-7 text-[color:var(--color-ink-primary)]">{l.text}</span>
                <span className="col-span-2 text-right">
                  <AlertPill severity="execute">verified</AlertPill>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

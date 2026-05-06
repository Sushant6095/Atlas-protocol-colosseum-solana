// /treasury/[id]/confidential — Disclosure-tier-aware dashboard (Phase 23 §8.10).

"use client";

import { use, useState } from "react";
import { Eye, Lock, FileText } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Tile } from "@/components/primitives/Tile";

type Tier = "PublicAuditor" | "Operator" | "FinanceAdmin" | "Recipient";

const TIER_HIERARCHY: Tier[] = ["PublicAuditor", "Recipient", "Operator", "FinanceAdmin"];

const PROTOCOLS = [
  { protocol: "Kamino · USDC",   bps: 4_500, notional_q64: "3753000" },
  { protocol: "Drift · kSOL",    bps: 1_600, notional_q64: "1334000" },
  { protocol: "Marginfi · USDC", bps: 1_500, notional_q64: "1251000" },
  { protocol: "Jupiter · JLP",   bps:   900, notional_q64:  "751000" },
];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Phase 23 demo — Phase 24 wires to the actual viewing-key vault.
  const [tier, setTier] = useState<Tier>("Operator");
  const [unblindCount, setUnblindCount] = useState({ tvl: 0, perProtocol: 0, recipients: 0 });

  const showAggregate     = tier === "PublicAuditor" || tier === "Operator" || tier === "FinanceAdmin";
  const showPerProtocol   = tier === "Operator" || tier === "FinanceAdmin";
  const showNotional      = tier === "FinanceAdmin";
  const showRecipientList = tier === "FinanceAdmin" || tier === "Recipient";

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            phase 14 confidential · disclosure-tier aware
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-display text-[20px]">Confidential dashboard</h1>
            <IdentifierMono value={id} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {TIER_HIERARCHY.map((t) => (
            <button key={t} onClick={() => setTier(t)}
                    className={`px-2.5 h-7 rounded-[var(--radius-sm)] text-[11px] font-mono ${
                      tier === t
                        ? "bg-[color:var(--color-accent-zk)]/15 text-[color:var(--color-accent-zk)] border border-[color:var(--color-accent-zk)]/40"
                        : "border border-[color:var(--color-line-medium)] text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-line-soft)]"
                    }`}>
              {t}
            </button>
          ))}
          <Button variant="ghost" size="sm">
            <FileText className="h-3.5 w-3.5" /> generate disclosure report
          </Button>
        </div>
      </header>

      <Panel surface="raised" density="dense" accent="zk">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-[color:var(--color-accent-zk)]" />
          <p className="text-[12px] text-[color:var(--color-ink-secondary)]">
            Active tier · <span className="font-mono text-[color:var(--color-accent-zk)]">{tier}</span>.
            Each unblind on this page writes a Phase 14 I-17 disclosure-event row to the audit log
            (Bubblegum-anchored).
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-4">
          <header className="mb-2"><Title>aggregate</Title></header>
          {showAggregate ? (
            <>
              <Tile label="tvl"          value="$8.34M"   mono accent="execute" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Tile label="apy 30d"  value="8.54%"  mono />
                <Tile label="vaults"   value={4}       mono />
              </div>
              <p className="mt-3 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                disclosure events · last 30d · {unblindCount.tvl}
              </p>
            </>
          ) : <Hidden />}
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-2 flex items-center justify-between">
            <Title>per protocol</Title>
            {showPerProtocol && !showNotional ? (
              <button onClick={() => setUnblindCount((c) => ({ ...c, perProtocol: c.perProtocol + 1 }))}
                      className="inline-flex items-center gap-1 text-[10px] text-[color:var(--color-accent-zk)] hover:underline">
                <Eye className="h-3 w-3" /> reveal notional
              </button>
            ) : null}
          </header>
          {showPerProtocol ? (
            <table className="w-full font-mono text-[11px]">
              <tbody>
                {PROTOCOLS.map((p) => (
                  <tr key={p.protocol} className="border-t border-[color:var(--color-line-soft)]">
                    <td className="py-1.5 text-[color:var(--color-ink-primary)]">{p.protocol}</td>
                    <td className="py-1.5 text-right text-[color:var(--color-ink-secondary)]">{(p.bps / 100).toFixed(2)}%</td>
                    <td className="py-1.5 text-right text-[color:var(--color-ink-tertiary)]">
                      {showNotional || unblindCount.perProtocol > 0
                        ? `$${(Number(p.notional_q64) / 1_000).toFixed(0)}k`
                        : "— · key required"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Hidden />}
          {showPerProtocol ? (
            <p className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
              disclosure events · last 30d · {unblindCount.perProtocol}
            </p>
          ) : null}
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-3">
          <header className="mb-2 flex items-center justify-between">
            <Title>recipients</Title>
            {showRecipientList ? (
              <button onClick={() => setUnblindCount((c) => ({ ...c, recipients: c.recipients + 1 }))}
                      className="inline-flex items-center gap-1 text-[10px] text-[color:var(--color-accent-zk)] hover:underline">
                <Eye className="h-3 w-3" /> reveal
              </button>
            ) : null}
          </header>
          {showRecipientList ? (
            <ul className="font-mono text-[11px] space-y-1.5">
              {["payroll · 12 employees", "ACME GmbH", "Audit firm", "Hosting · AWS"].map((r) => (
                <li key={r} className="text-[color:var(--color-ink-secondary)]">· {r}</li>
              ))}
            </ul>
          ) : <Hidden />}
          {showRecipientList ? (
            <p className="mt-3 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
              disclosure events · last 30d · {unblindCount.recipients}
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel surface="raised" density="dense">
        <header className="mb-3"><Title>active tier · contract</Title></header>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] text-[color:var(--color-ink-secondary)]">
          <li>· <strong className="text-[color:var(--color-ink-primary)]">PublicAuditor</strong> — aggregate metrics only.</li>
          <li>· <strong className="text-[color:var(--color-ink-primary)]">Operator</strong>      — per-protocol ratios; no notional.</li>
          <li>· <strong className="text-[color:var(--color-ink-primary)]">FinanceAdmin</strong>  — full panels; every page view writes an I-17 audit row.</li>
          <li>· <strong className="text-[color:var(--color-ink-primary)]">Recipient</strong>     — own-payouts only.</li>
        </ul>
      </Panel>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{children}</span>;
}

function Hidden() {
  return (
    <div className="grid place-items-center py-8 gap-2 text-center">
      <Lock className="h-5 w-5 text-[color:var(--color-ink-tertiary)]" />
      <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">key required</p>
    </div>
  );
}

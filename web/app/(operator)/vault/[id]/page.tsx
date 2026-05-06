// /vault/[id] — Vault Intelligence Terminal (Phase 23 §2).

import Link from "next/link";
import { ArrowRight, Lock, ShieldAlert } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Button } from "@/components/primitives/Button";
import {
  AllocationBar,
  AgentSidecar,
  BottomStrip,
  RiskRadarMini,
  Sparkline,
  VaultStatusBar,
  type AllocationLeg,
} from "@/components/operator";
import { RegimeBadge } from "@/components/narrative";

const ALLOCATION: AllocationLeg[] = [
  { protocol: "Kamino",   asset: "USDC", bps: 4_200, in_universe: true,  notional_q64: "1940000" },
  { protocol: "Drift",    asset: "kSOL", bps: 1_800, in_universe: true,  notional_q64: "830000"  },
  { protocol: "Marginfi", asset: "USDC", bps: 1_400, in_universe: true,  notional_q64: "650000"  },
  { protocol: "Jupiter",  asset: "JLP",  bps: 1_100, in_universe: true,  notional_q64: "510000"  },
  { protocol: "Drift",    asset: "SOL",  bps: 0,     in_universe: true,  notional_q64: "0"       },
  { protocol: "Meteora",  asset: "USDC", bps: 0,     in_universe: false, notional_q64: "0"       },
];

const APY_30D = [0.74, 0.78, 0.81, 0.85, 0.83, 0.87, 0.89, 0.86, 0.84, 0.82, 0.85, 0.88];
const DRAWDOWN = [0, -0.4, -0.8, -1.1, -0.7, -0.6, -0.9, -1.2, -0.8, -0.4, -0.2, -0.1];

const RADAR = [
  { axis: "tail",          value: 0.42 },
  { axis: "liquidity",     value: 0.18 },
  { axis: "oracle",        value: 0.24 },
  { axis: "concentration", value: 0.31 },
  { axis: "leverage",      value: 0.28 },
  { axis: "drawdown",      value: 0.22 },
];

const STRATEGY_HASH = "a1b2c3d4" + "0".repeat(56);
const REBALANCE_HASH = "9081a2b3" + "f".repeat(56);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const defensive = false;
  const confidential = false;
  return (
    <>
      <VaultStatusBar
        vault={{ id, name: "PUSD · Yield Balanced" }}
        defensiveMode={defensive}
        confidentialMode={confidential}
      />

      <div className="px-4 py-4 space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              vault intelligence terminal
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-display text-[24px]">PUSD · Yield Balanced</h1>
              <AlertPill severity="info">Balanced</AlertPill>
              <RegimeBadge regime="risk_on" />
              {confidential ? (
                <AlertPill severity="zk">
                  <Lock className="h-3 w-3 mr-1 inline" />confidential
                </AlertPill>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[color:var(--color-ink-tertiary)]">
              <span>vault</span>
              <IdentifierMono value={id} copy size="xs" />
              <span>·</span>
              <span>strategy_commitment</span>
              <IdentifierMono value={STRATEGY_HASH} copy size="xs" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/vault/${id}/rebalances`}>
              <Button variant="secondary" size="sm">Rebalances <kbd className="ml-1 font-mono text-[10px]">r</kbd></Button>
            </Link>
            <Link href={`/vault/${id}/proofs`}>
              <Button variant="secondary" size="sm">Proofs <kbd className="ml-1 font-mono text-[10px]">p</kbd></Button>
            </Link>
            <Link href={`/vault/${id}/agents`}>
              <Button variant="ghost" size="sm">Agents <kbd className="ml-1 font-mono text-[10px]">a</kbd></Button>
            </Link>
          </div>
        </header>

        {defensive ? (
          <Panel surface="raised" density="dense" accent="warn">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 text-[color:var(--color-accent-warn)]" />
              <p className="text-[12px] text-[color:var(--color-ink-secondary)]">
                Defensive mode engaged at slot 245_002_400 — TailRisk hard veto.
              </p>
            </div>
          </Panel>
        ) : null}

        <div className="grid grid-cols-12 gap-3">
          <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
            <header className="mb-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                allocation · current vs strategy universe
              </p>
            </header>
            <AllocationBar legs={ALLOCATION} showNotional={!confidential} />
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">
                30-day history · per protocol
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALLOCATION.filter((l) => l.bps > 0).map((l) => (
                  <div key={`${l.protocol}-${l.asset}-spark`} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[color:var(--color-ink-secondary)] w-24 truncate">
                      {l.protocol}·{l.asset}
                    </span>
                    <Sparkline values={genSeries(12, l.bps / 100)} className="flex-1" height={20} />
                    <span className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)] w-12 text-right">
                      {(l.bps / 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-4">
            <header className="mb-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                performance · realised
              </p>
            </header>
            <div className="grid grid-cols-3 gap-3">
              <Tile label="apy 7d"  value="8.42%" mono accent="execute" />
              <Tile label="apy 30d" value="8.54%" mono accent="execute" />
              <Tile label="apy 90d" value="8.31%" mono />
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">
                drawdown · 90d
              </p>
              <Sparkline
                values={DRAWDOWN}
                stroke="var(--color-accent-warn)"
                fill="var(--color-accent-warn)"
                height={48}
                width={320}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Tile label="defi yield"     value="6.40%" mono />
              <Tile label="interest yield" value="2.18%" mono />
              <Tile label="rebalance cost" value="0.04%" mono />
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">capital efficiency</p>
              <p className="font-mono text-[18px] mt-1">94.3%</p>
            </div>
          </Panel>

          <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-3">
            <header className="mb-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                risk · 6-axis
              </p>
            </header>
            <RiskRadarMini values={RADAR} size={200} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Tile label="max ddown" value="−1.2%"  mono />
              <Tile label="vol 30d"   value="0.62"   mono />
              <Tile label="oracle Δ"  value="14 bps" mono />
              <Tile label="leverage"  value="1.18×"  mono />
            </div>
          </Panel>
        </div>

        <Panel surface="raised" density="dense">
          <header className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                last rebalance
              </p>
              <AlertPill severity="execute">verified</AlertPill>
              <span className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
                slot 245_002_880 · 12s ago
              </span>
            </div>
            <Link href={`/vault/${id}/rebalances/${REBALANCE_HASH}`}>
              <Button variant="primary" size="sm">
                Open black box
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </header>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-7">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Tile label="ratio diff"         value="+12.0% Kamino · −8.0% Drift" mono />
                <Tile label="agent disagreement" value="21.4%" mono />
              </div>
              <p className="text-[12px] text-[color:var(--color-ink-secondary)]">
                Kamino USDC supply rate ranks above 14d median; Drift kSOL APY decayed 220 bps over 14d.
              </p>
              <p className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                explanation_hash · poseidon · <IdentifierMono value={REBALANCE_HASH} size="xs" /> · rendering, not commitment
              </p>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">
                bundle landed
              </p>
              <div className="grid grid-cols-3 gap-2 font-mono text-[12px]">
                <Tile label="route"        value="Jito"  mono />
                <Tile label="cu used"      value="1.12M" mono />
                <Tile label="size · bytes" value="1180"  mono />
              </div>
              <p className="mt-3">
                <Sparkline values={APY_30D} stroke="var(--color-accent-execute)" fill="var(--color-accent-execute)" height={28} width={320} />
              </p>
            </div>
          </div>
        </Panel>

        {/* Inline sidecar — Phase 23 layout-context lift in Phase 24 */}
        <Panel surface="raised" density="dense">
          <AgentSidecar />
        </Panel>
      </div>

      <BottomStrip
        pendingCount={2}
        lastRebalanceSecondsAgo={12}
        hints={[
          { keys: "r",  label: "rebalances" },
          { keys: "p",  label: "proofs" },
          { keys: "a",  label: "agents" },
          { keys: "⌘.", label: "rail" },
        ]}
      />
    </>
  );
}

function genSeries(n: number, around: number): number[] {
  const out: number[] = [];
  let v = around;
  for (let i = 0; i < n; i++) {
    v = Math.max(0, v + (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * 0.4);
    out.push(v);
  }
  return out;
}

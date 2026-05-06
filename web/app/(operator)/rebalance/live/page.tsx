// /rebalance/live — Live Rebalance Command Center (Phase 23 §7).
// Four-quadrant operator dashboard.

"use client";

import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Tile } from "@/components/primitives/Tile";
import { Sparkline } from "@/components/operator/Sparkline";
import { ProofLifecycle, PROOF_STAGES } from "@/components/narrative";

type Stage = typeof PROOF_STAGES[number]["id"];

interface ActiveRebalance {
  vault: string;
  current: Stage;
  elapsed_ms: number;
  projected_ms: number;
  route: "Jito" | "SWQoS" | "DFlow";
}

const ACTIVE: ActiveRebalance[] = [
  { vault: "ab12cdef" + "0".repeat(56), current: "prove",   elapsed_ms: 32_000, projected_ms: 60_000, route: "Jito"  },
  { vault: "01a02b03" + "0".repeat(56), current: "explain", elapsed_ms:  4_000, projected_ms: 65_000, route: "Jito"  },
  { vault: "ff10ee20" + "0".repeat(56), current: "settle",  elapsed_ms: 78_000, projected_ms: 82_000, route: "DFlow" },
  { vault: "deadbeef" + "0".repeat(56), current: "verify",  elapsed_ms: 71_000, projected_ms: 75_000, route: "Jito"  },
];

interface Bundle {
  id: string;
  route: "Jito" | "SWQoS" | "DFlow";
  state: "submitted" | "landed" | "dropped";
  tip_lamports: number;
  landed_rate_bps: number;
}

const BUNDLES: Bundle[] = [
  { id: "0x6a1f" + "0".repeat(60), route: "Jito",  state: "landed",    tip_lamports: 12_000, landed_rate_bps: 9_840 },
  { id: "0xb2e8" + "0".repeat(60), route: "Jito",  state: "submitted", tip_lamports:  9_500, landed_rate_bps: 9_640 },
  { id: "0xc391" + "0".repeat(60), route: "SWQoS", state: "submitted", tip_lamports:      0, landed_rate_bps: 9_120 },
  { id: "0xd4a0" + "0".repeat(60), route: "DFlow", state: "landed",    tip_lamports:      0, landed_rate_bps: 9_280 },
];

const LATENCY_E2E = Array.from({ length: 60 }, (_, i) => 28 + Math.sin(i * 0.4) * 3 + (i > 40 ? 6 : 0));
const LATENCY_PROVE = Array.from({ length: 60 }, (_, i) => 56 + Math.cos(i * 0.5) * 4);

export default function Page() {
  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            live command center
          </p>
          <h1 className="text-display text-[20px] mt-1">Realtime operations</h1>
        </div>
        <div className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
          stream.network · stream.vault.*.rebalance · stream.bundle.*
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* TL: Active rebalances */}
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          <header className="mb-3"><Title>active rebalances · {ACTIVE.length}</Title></header>
          <ul className="divide-y divide-[color:var(--color-line-soft)]">
            {ACTIVE.map((r) => {
              const stagePct = stageToPct(r.current);
              return (
                <li key={r.vault} className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <IdentifierMono value={r.vault} size="xs" />
                    <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                      route {r.route} · elapsed {(r.elapsed_ms / 1_000).toFixed(0)}s · projected {(r.projected_ms / 1_000).toFixed(0)}s
                    </span>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-9">
                      <ProofLifecycle highlight={r.current} autoplay={false} />
                    </div>
                    <div className="col-span-3">
                      <div className="h-1.5 rounded-[var(--radius-xs)] bg-[color:var(--color-line-medium)] overflow-hidden">
                        <div className="h-full bg-[color:var(--color-accent-zk)]" style={{ width: `${stagePct}%` }} />
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-[color:var(--color-ink-tertiary)] text-right">
                        {Math.round(stagePct)}%
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* TR: Bundle status */}
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-3"><Title>bundle status</Title></header>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="py-1 pr-2">bundle</th>
                <th className="py-1 pr-2">route</th>
                <th className="py-1 pr-2 text-right">tip</th>
                <th className="py-1 pr-2 text-right">landed bps</th>
                <th className="py-1 pr-2">state</th>
              </tr>
            </thead>
            <tbody>
              {BUNDLES.map((b) => (
                <tr key={b.id} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5 pr-2"><IdentifierMono value={b.id} size="xs" /></td>
                  <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{b.route}</td>
                  <td className="py-1.5 pr-2 text-right">{(b.tip_lamports / 1_000).toFixed(1)}k</td>
                  <td className="py-1.5 pr-2 text-right">{b.landed_rate_bps}</td>
                  <td className="py-1.5 pr-2">
                    {b.state === "landed"
                      ? <AlertPill severity="execute">landed</AlertPill>
                      : b.state === "submitted"
                        ? <AlertPill severity="warn">submitted</AlertPill>
                        : <AlertPill severity="danger">dropped</AlertPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* BL: Latency timeline */}
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          <header className="mb-3"><Title>latency timeline · last 60m</Title></header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Series label="e2e seconds"     values={LATENCY_E2E}   color="var(--color-accent-electric)" />
            <Series label="prove seconds"   values={LATENCY_PROVE} color="var(--color-accent-zk)"        />
          </div>
        </Panel>

        {/* BR: Network conditions */}
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-3"><Title>network conditions</Title></header>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="tps p50"            value="2.4k"  mono />
            <Tile label="tps p99"            value="3.7k"  mono />
            <Tile label="congestion"         value="0.31"  mono accent="warn" />
            <Tile label="prio fee p50"       value="800 µ" mono />
            <Tile label="prio fee p99"       value="6.2k µ" mono accent="warn" />
            <Tile label="validator p99"      value="86 ms" mono />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
      {children}
    </span>
  );
}

function Series({ label, values, color }: { label: string; values: number[]; color: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-1">
        {label}
      </p>
      <Sparkline values={values} stroke={color} fill={color} height={64} width={420} />
      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
        <span>min {Math.min(...values).toFixed(1)}</span>
        <span>max {Math.max(...values).toFixed(1)}</span>
      </div>
    </div>
  );
}

function stageToPct(s: Stage): number {
  const idx = PROOF_STAGES.findIndex((x) => x.id === s);
  return ((idx + 1) / PROOF_STAGES.length) * 100;
}

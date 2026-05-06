// /infra public observatory — 12-panel grid (Phase 22 §5).
//
// Reads from `/api/v1/infra` via `useAtlas()` + TanStack Query;
// upgrades to live ticks via the realtime store when WS subscribers
// (Phase 17 stream.infra.*) attach.

"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtlas, queryKeys } from "@/lib/sdk";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { AlertPill, type AlertSeverity } from "@/components/primitives/AlertPill";
import { SkeletonChart, SkeletonRow } from "@/components/system";

interface InfraSnapshot {
  generated_at_slot: number;
  rpc_latency: { source: string; role: string; region: string; p50_ms: number; p99_ms: number }[];
  quorum_match_rate_bps_1h: number;
  slot_lag_per_source: { source: string; lag_slots: number }[];
  attribution_heatmap: {
    source: string;
    consistent: number;
    slot_skew: number;
    content_divergence: number;
    outlier_share_bps: number;
  }[];
  network_tps_p50: number;
  network_tps_p99: number;
  jito_landed_rate_bps_1m: number;
  validator_latency_by_region: { region: string; p99_ms: number }[];
  cu_p50_per_rebalance: number;
  cu_p99_per_rebalance: number;
  proof_gen_p50_ms: number;
  proof_gen_p99_ms: number;
  rebalance_e2e_p50_ms: number;
  rebalance_e2e_p99_ms: number;
  pyth_post_latency_p99_ms: number;
  freshness_budgets: {
    vault_id: string;
    slot_drift: number;
    freshness_remaining_slots: number;
    band: "green" | "amber" | "red";
  }[];
}

function InfraGridImpl() {
  const atlas = useAtlas();
  const q = useQuery({
    queryKey: queryKeys.infra.snapshot(),
    queryFn: () => atlas.getJson<InfraSnapshot>("/api/v1/infra"),
    refetchInterval: 5_000,
  });
  const s = q.data;

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Tier-A latency */}
      <Panel surface="raised" density="dense" className="col-span-4">
        <header className="mb-3 flex items-center justify-between">
          <PanelTitle>RPC tier-A latency</PanelTitle>
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">budget ≤ 250ms</span>
        </header>
        {s ? (
          <TierTiles role="tier_a_latency" rows={s.rpc_latency} budget={250} />
        ) : <SkeletonRow cols={3} />}
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-4">
        <header className="mb-3 flex items-center justify-between">
          <PanelTitle>RPC tier-B latency</PanelTitle>
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">budget ≤ 800ms</span>
        </header>
        {s ? (
          <TierTiles role="tier_b_quorum" rows={s.rpc_latency} budget={800} />
        ) : <SkeletonRow cols={3} />}
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-4">
        <header className="mb-3"><PanelTitle>Quorum match rate (1h)</PanelTitle></header>
        {s ? (
          <Tile
            label="match rate"
            value={`${s.quorum_match_rate_bps_1h ?? 0} bps`}
            hint="SLO ≥ 9_950"
            accent={s.quorum_match_rate_bps_1h >= 9_950 ? "execute" : "warn"}
          />
        ) : <SkeletonRow cols={2} />}
      </Panel>

      {/* Slot lag + attribution */}
      <Panel surface="raised" density="dense" className="col-span-6">
        <header className="mb-3"><PanelTitle>Slot lag per source</PanelTitle></header>
        {s ? (
          <table className="w-full text-[12px] font-mono">
            <tbody>
              {s.slot_lag_per_source.map((r) => (
                <tr key={r.source} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5 text-[color:var(--color-ink-secondary)]">{r.source}</td>
                  <td className="py-1.5 text-right">{r.lag_slots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <SkeletonRow cols={2} />}
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-6">
        <header className="mb-3 flex items-center justify-between">
          <PanelTitle>Slot-drift attribution heatmap</PanelTitle>
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">last 24h</span>
        </header>
        {s ? <AttributionHeatmap rows={s.attribution_heatmap} /> : <SkeletonRow cols={4} />}
      </Panel>

      {/* TPS / Jito / Pyth */}
      <Panel surface="raised" density="dense" className="col-span-4">
        <header className="mb-3"><PanelTitle>Network TPS</PanelTitle></header>
        {s ? (
          <div className="grid grid-cols-2 gap-3">
            <Tile label="p50" value={fmt(s.network_tps_p50)} mono />
            <Tile label="p99" value={fmt(s.network_tps_p99)} mono />
          </div>
        ) : <SkeletonRow cols={2} />}
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-4">
        <header className="mb-3"><PanelTitle>Jito bundle landed (1m)</PanelTitle></header>
        {s ? (
          <Tile
            label="landed rate"
            value={`${s.jito_landed_rate_bps_1m ?? 0} bps`}
            hint="SLO ≥ 9_500"
            accent={s.jito_landed_rate_bps_1m >= 9_500 ? "execute" : "warn"}
          />
        ) : <SkeletonRow cols={2} />}
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-4">
        <header className="mb-3"><PanelTitle>Pyth post latency</PanelTitle></header>
        {s ? <Tile label="p99" value={fmtMs(s.pyth_post_latency_p99_ms)} mono /> : <SkeletonRow cols={1} />}
      </Panel>

      {/* Validator latency by region */}
      <Panel surface="raised" density="dense" className="col-span-6">
        <header className="mb-3"><PanelTitle>Validator latency by region</PanelTitle></header>
        {s ? (
          <table className="w-full text-[12px] font-mono">
            <tbody>
              {s.validator_latency_by_region.map((r) => (
                <tr key={r.region} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5 text-[color:var(--color-ink-secondary)]">{r.region}</td>
                  <td className="py-1.5 text-right">{fmtMs(r.p99_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <SkeletonRow cols={2} />}
      </Panel>

      {/* CU + proof gen + rebalance e2e */}
      <Panel surface="raised" density="dense" className="col-span-2">
        <header className="mb-3"><PanelTitle>CU / rebalance</PanelTitle></header>
        {s ? (
          <>
            <Tile label="p50" value={fmtCu(s.cu_p50_per_rebalance)} mono />
            <div className="mt-3"><Tile label="p99" value={fmtCu(s.cu_p99_per_rebalance)} mono /></div>
          </>
        ) : <SkeletonRow cols={1} />}
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-2">
        <header className="mb-3"><PanelTitle>Proof gen</PanelTitle></header>
        {s ? (
          <>
            <Tile label="p50" value={fmtSec(s.proof_gen_p50_ms)} mono />
            <div className="mt-3"><Tile label="p99" value={fmtSec(s.proof_gen_p99_ms)} mono /></div>
          </>
        ) : <SkeletonRow cols={1} />}
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-2">
        <header className="mb-3"><PanelTitle>Rebalance e2e</PanelTitle></header>
        {s ? (
          <>
            <Tile label="p50" value={fmtSec(s.rebalance_e2e_p50_ms)} mono />
            <div className="mt-3"><Tile label="p99" value={fmtSec(s.rebalance_e2e_p99_ms)} mono /></div>
          </>
        ) : <SkeletonRow cols={1} />}
      </Panel>

      {/* Freshness */}
      <Panel surface="raised" density="dense" className="col-span-6">
        <header className="mb-3"><PanelTitle>Slot Freshness Budget · per active vault</PanelTitle></header>
        {s ? <FreshnessRows rows={s.freshness_budgets} /> : <SkeletonRow cols={3} />}
      </Panel>

      {/* Sample snapshot */}
      <Panel surface="raised" density="dense" className="col-span-12">
        <header className="mb-3 flex items-center justify-between">
          <PanelTitle>Raw snapshot</PanelTitle>
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            generated_at_slot · {s?.generated_at_slot ?? "—"}
          </span>
        </header>
        {s ? (
          <pre className="font-mono text-[11px] leading-[16px] text-[color:var(--color-ink-tertiary)] max-h-[160px] overflow-auto scroll-area">
            <code>{JSON.stringify(s, null, 2)}</code>
          </pre>
        ) : <SkeletonChart />}
      </Panel>
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
      {children}
    </span>
  );
}

function TierTiles({
  role,
  rows,
  budget,
}: { role: string; rows: InfraSnapshot["rpc_latency"]; budget: number }) {
  const filtered = rows.filter((r) => r.role === role);
  if (filtered.length === 0) {
    return <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">no samples</p>;
  }
  const median = (xs: number[]) => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0;
  const p50 = median(filtered.map((r) => r.p50_ms));
  const p99 = Math.max(...filtered.map((r) => r.p99_ms));
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label="p50" value={fmtMs(p50)} mono />
      <Tile
        label="p99"
        value={fmtMs(p99)}
        accent={p99 <= budget ? "execute" : "warn"}
        mono
      />
    </div>
  );
}

function AttributionHeatmap({ rows }: { rows: InfraSnapshot["attribution_heatmap"] }) {
  return (
    <table className="w-full text-[11px] font-mono">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          <th className="py-1 pr-2">source</th>
          <th className="py-1 pr-2 text-right">consistent</th>
          <th className="py-1 pr-2 text-right">skew</th>
          <th className="py-1 pr-2 text-right">divergence</th>
          <th className="py-1 text-right">outlier</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const sev: AlertSeverity = r.outlier_share_bps >= 4_000 ? "danger" : r.outlier_share_bps >= 1_500 ? "warn" : "ok";
          return (
            <tr key={r.source} className="border-t border-[color:var(--color-line-soft)]">
              <td className="py-1 pr-2 text-[color:var(--color-ink-secondary)]">{r.source}</td>
              <td className="py-1 pr-2 text-right">{r.consistent}</td>
              <td className="py-1 pr-2 text-right">{r.slot_skew}</td>
              <td className="py-1 pr-2 text-right">{r.content_divergence}</td>
              <td className="py-1 text-right">
                <AlertPill severity={sev}>{r.outlier_share_bps} bps</AlertPill>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FreshnessRows({ rows }: { rows: InfraSnapshot["freshness_budgets"] }) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">no active vaults</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const sev: AlertSeverity = r.band === "green" ? "ok" : r.band === "amber" ? "warn" : "danger";
        const pct = Math.round((r.freshness_remaining_slots / 150) * 100);
        return (
          <li key={r.vault_id} className="grid grid-cols-12 items-center gap-2">
            <span className="col-span-4 font-mono text-[11px] text-[color:var(--color-ink-secondary)] truncate">
              {short(r.vault_id)}
            </span>
            <div className="col-span-5 h-1.5 rounded-[var(--radius-xs)] overflow-hidden bg-[color:var(--color-line-medium)]">
              <div
                className={`h-full ${sev === "ok" ? "bg-[color:var(--color-accent-execute)]" : sev === "warn" ? "bg-[color:var(--color-accent-warn)]" : "bg-[color:var(--color-accent-danger)]"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="col-span-2 font-mono text-[11px] text-right">{r.freshness_remaining_slots}/150</span>
            <span className="col-span-1 flex justify-end">
              <AlertPill severity={sev}>{r.band}</AlertPill>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function fmt(n: number | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toString();
}
function fmtMs(ms: number | undefined): string {
  if (ms == null) return "—";
  return `${Math.round(ms)} ms`;
}
function fmtSec(ms: number | undefined): string {
  if (ms == null) return "—";
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)} ms`;
}
function fmtCu(cu: number | undefined): string {
  if (cu == null) return "—";
  return `${(cu / 1_000).toFixed(0)}k`;
}
function short(s: string): string {
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

export const InfraGrid = memo(InfraGridImpl);
InfraGrid.displayName = "InfraGrid";

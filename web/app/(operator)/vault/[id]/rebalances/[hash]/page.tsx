// /vault/[id]/rebalances/[hash] — Black-Box Record (Phase 23 §3.2).
// Auditor-facing drilldown of one rebalance.

"use client";

import { use } from "react";
import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Button } from "@/components/primitives/Button";
import { VerifyInBrowser, type ProofShape } from "@/components/proofs/VerifyInBrowser";
import { AgentEnsemblePanel, type AgentProposal } from "@/components/decision/AgentEnsemblePanel";

const PROOF: ProofShape = {
  publicInputHex: "00".repeat(268),
  proofBytes: Array.from({ length: 256 }, (_, i) => i & 0xff),
  archiveRootSlot: 245_002_400,
  archiveRoot: "a1".repeat(32),
  merkleProofPath: ["b2".repeat(32), "c3".repeat(32), "d4".repeat(32)],
};

const PROPOSALS: AgentProposal[] = [
  { agent: "risk",       confidence_bps: 8_400, vote: "support",   rationale: "Drawdown bounded; concentration index 0.31." },
  { agent: "yield",      confidence_bps: 6_200, vote: "soft_veto", rationale: "Drift APY decayed 220 bps over 14d." },
  { agent: "liquidity",  confidence_bps: 7_400, vote: "support",   rationale: "Depth-1pct ≥ 5× rebalance notional." },
  { agent: "tail-risk",  confidence_bps: 7_100, vote: "support",   rationale: "Vol regime within bound." },
  { agent: "compliance", confidence_bps: 8_800, vote: "support",   rationale: "All routes pass region + sanctions." },
  { agent: "execution",  confidence_bps: 7_900, vote: "support",   rationale: "Predictive routing favours Drift→Kamino." },
  { agent: "observer",   confidence_bps: 6_500, vote: "soft_veto", rationale: "Cross-chain mirror diverges by 3.4%." },
];

const STATE_DIFF = [
  { protocol: "Kamino · USDC",   before: 30.0, after: 42.0 },
  { protocol: "Drift · kSOL",    before: 26.0, after: 18.0 },
  { protocol: "Marginfi · USDC", before: 14.0, after: 14.0 },
  { protocol: "Jupiter · JLP",   before: 11.0, after: 11.0 },
  { protocol: "idle buffer",     before: 19.0, after: 15.0 },
];

const CPI_TRACE = [
  { ix: 0, program: "Compute Budget",   call: "set_compute_unit_limit(1_200_000)",                 cu:    300, post: "ok" },
  { ix: 1, program: "Pyth pull",        call: "post_update(kSOL/USDC, vlbe_..)",                   cu:  6_400, post: "ok" },
  { ix: 2, program: "Atlas Verifier",   call: "verify(public_input_v2, proof, vk_hash)",          cu:248_000, post: "ok" },
  { ix: 3, program: "Atlas Rebalancer", call: "execute(post_state_commitment)",                   cu: 18_400, post: "ok" },
  { ix: 4, program: "Drift v2",         call: "withdraw_collateral(kSOL, 8.0%)",                  cu: 84_000, post: "ok" },
  { ix: 5, program: "Kamino Lend",      call: "deposit(USDC, 12.0%)",                              cu: 92_000, post: "ok" },
  { ix: 6, program: "Atlas Vault",      call: "apply_post_state(after_root)",                      cu: 16_400, post: "ok" },
  { ix: 7, program: "Bubblegum",        call: "append_leaf(rebalance_receipt)",                    cu: 64_400, post: "ok" },
];

const TIMINGS_MS = [
  { stage: "ingest",    ms:    340 },
  { stage: "infer",     ms:    180 },
  { stage: "consensus", ms:    120 },
  { stage: "allocate",  ms:     90 },
  { stage: "explain",   ms:     40 },
  { stage: "prove",     ms: 58_400 },
  { stage: "verify",    ms:    150 },
  { stage: "submit",    ms:  3_400 },
];

export default function Page({ params }: { params: Promise<{ id: string; hash: string }> }) {
  const { id, hash } = use(params);
  return (
    <div className="px-4 py-4 space-y-4">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            black-box record
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-display text-[20px]">vault</h1>
            <IdentifierMono value={id} size="sm" copy />
            <span className="text-[color:var(--color-ink-tertiary)]">·</span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              public_input_hash
            </span>
            <IdentifierMono value={hash} size="sm" copy />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/vault/${id}/rebalances`}>
            <Button variant="ghost" size="sm">← back to list</Button>
          </Link>
          <VerifyInBrowser proof={PROOF} />
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* Outcome */}
        <Panel surface="raised" density="dense" className="col-span-12 md:col-span-4">
          <header className="mb-2"><PanelTitle>outcome</PanelTitle></header>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="status"      value="landed"  accent="execute" mono />
            <Tile label="landed slot" value="245_002_881" mono />
            <Tile label="bundle id"   value="0x6a1f…" mono />
            <Tile label="prover"      value="prover.iad.01" mono />
          </div>
        </Panel>

        {/* Decision */}
        <Panel surface="raised" density="dense" className="col-span-12 md:col-span-4">
          <header className="mb-2"><PanelTitle>decision · summary</PanelTitle></header>
          <p className="text-[12px] text-[color:var(--color-ink-secondary)]">
            Kamino USDC supply rate ranks above 14d median; Drift kSOL APY decayed 220 bps over 14d.
            Allocation shifts +12.0% Kamino, −8.0% Drift; idle buffer narrows from 19.0% to 15.0%.
          </p>
          <p className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            explanation_hash · <IdentifierMono value="9081a2b3" size="xs" />
          </p>
        </Panel>

        {/* Verify */}
        <Panel surface="raised" density="dense" className="col-span-12 md:col-span-4">
          <header className="mb-2"><PanelTitle>verify</PanelTitle></header>
          <p className="text-[12px] text-[color:var(--color-ink-secondary)] mb-3">
            Click to verify the proof in your browser. Atlas&apos;s API is not in
            the trust path — sp1-solana runs the math.
          </p>
          <VerifyInBrowser proof={PROOF} />
          <p className="mt-3 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            archive_root · <IdentifierMono value={PROOF.archiveRoot} size="xs" /> · slot {PROOF.archiveRootSlot.toLocaleString()}
          </p>
        </Panel>
      </div>

      {/* State diff */}
      <Panel surface="raised" density="dense">
        <header className="mb-3 flex items-center justify-between">
          <PanelTitle>state diff · before → after</PanelTitle>
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            confidential mode hides notionals — viewing-key reveal writes I-17 row
          </span>
        </header>
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-1 pr-2">protocol · asset</th>
              <th className="py-1 pr-2 text-right">before</th>
              <th className="py-1 pr-2 text-right">after</th>
              <th className="py-1 pr-2 text-right">Δ</th>
              <th className="py-1">flow</th>
            </tr>
          </thead>
          <tbody>
            {STATE_DIFF.map((r) => {
              const delta = r.after - r.before;
              return (
                <tr key={r.protocol} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5 pr-2 text-[color:var(--color-ink-primary)]">{r.protocol}</td>
                  <td className="py-1.5 pr-2 text-right text-[color:var(--color-ink-secondary)]">{r.before.toFixed(1)}%</td>
                  <td className="py-1.5 pr-2 text-right">{r.after.toFixed(1)}%</td>
                  <td className={`py-1.5 pr-2 text-right ${delta >= 0 ? "text-[color:var(--color-accent-execute)]" : "text-[color:var(--color-accent-danger)]"}`}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                  </td>
                  <td className="py-1.5">
                    <div className="h-1.5 rounded-[var(--radius-xs)] bg-[color:var(--color-line-medium)] overflow-hidden">
                      <div className={`h-full ${delta >= 0 ? "bg-[color:var(--color-accent-execute)]" : "bg-[color:var(--color-accent-danger)]"}`}
                           style={{ width: `${Math.min(100, Math.abs(delta) * 5)}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {/* Decision · agents */}
      <AgentEnsemblePanel proposals={PROPOSALS} consensus_disagreement_bps={2_140} />

      {/* CPI trace */}
      <Panel surface="raised" density="dense">
        <header className="mb-3"><PanelTitle>execution · cpi trace</PanelTitle></header>
        <ol className="font-mono text-[11px]">
          {CPI_TRACE.map((step) => (
            <li key={step.ix} className="grid grid-cols-12 gap-3 py-1.5 border-t border-[color:var(--color-line-soft)] first:border-0">
              <span className="col-span-1 text-[color:var(--color-ink-tertiary)]">{String(step.ix).padStart(2, "0")}</span>
              <span className="col-span-3 text-[color:var(--color-ink-primary)]">{step.program}</span>
              <span className="col-span-6 text-[color:var(--color-ink-tertiary)]">{step.call}</span>
              <span className="col-span-1 text-right tabular-nums">{(step.cu / 1_000).toFixed(1)}k</span>
              <span className="col-span-1 text-right">
                <AlertPill severity="execute">{step.post}</AlertPill>
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {/* Timings */}
      <Panel surface="raised" density="dense">
        <header className="mb-3"><PanelTitle>timings · funnel ms</PanelTitle></header>
        <ul className="space-y-2">
          {(() => {
            const total = TIMINGS_MS.reduce((a, t) => a + t.ms, 0);
            return TIMINGS_MS.map((t) => {
              const pct = (t.ms / total) * 100;
              return (
                <li key={t.stage} className="grid grid-cols-12 items-center gap-3 font-mono text-[11px]">
                  <span className="col-span-2 text-[color:var(--color-ink-secondary)]">{t.stage}</span>
                  <div className="col-span-8 h-1.5 rounded-[var(--radius-xs)] bg-[color:var(--color-line-medium)] overflow-hidden">
                    <div className="h-full bg-[color:var(--color-accent-zk)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="col-span-2 text-right tabular-nums text-[color:var(--color-ink-tertiary)]">
                    {t.ms >= 1_000 ? `${(t.ms / 1_000).toFixed(1)}s` : `${t.ms}ms`}
                  </span>
                </li>
              );
            });
          })()}
        </ul>
      </Panel>
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{children}</span>;
}

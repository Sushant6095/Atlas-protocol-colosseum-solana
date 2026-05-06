// /treasury/[id]/proofs — Proof of Reserve (Phase 23 §8.8). Public-trust surface.

"use client";

import { use } from "react";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { AllocationBar, Sparkline, type AllocationLeg } from "@/components/operator";
import { VerifyInBrowser, type ProofShape } from "@/components/proofs/VerifyInBrowser";

const ALLOCATION: AllocationLeg[] = [
  { protocol: "Kamino",   asset: "USDC", bps: 4_500, in_universe: true,  notional_q64: "3753000" },
  { protocol: "Drift",    asset: "kSOL", bps: 1_600, in_universe: true,  notional_q64: "1334000" },
  { protocol: "Marginfi", asset: "USDC", bps: 1_500, in_universe: true,  notional_q64: "1251000" },
  { protocol: "Jupiter",  asset: "JLP",  bps:   900, in_universe: true,  notional_q64: "751000"  },
];

const PROOF: ProofShape = {
  publicInputHex: "00".repeat(268),
  proofBytes: Array.from({ length: 256 }, (_, i) => i & 0xff),
  archiveRootSlot: 245_002_400,
  archiveRoot: "a1".repeat(32),
  merkleProofPath: ["b2".repeat(32), "c3".repeat(32), "d4".repeat(32)],
};

const TIMELINE = [12.4, 12.8, 13.0, 13.6, 14.0, 14.5, 14.4, 14.7, 15.0, 15.2, 15.5, 15.8];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            phase 10 · proof of reserve · public-trust surface
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-display text-[20px]">Proof of reserve</h1>
            <IdentifierMono value={id} size="sm" />
          </div>
        </div>
        <VerifyInBrowser proof={PROOF} />
      </header>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              live allocation snapshot · per protocol
            </p>
          </header>
          <AllocationBar legs={ALLOCATION} showNotional />
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              most recent rebalance proof
            </p>
          </header>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="public input" value="v3" mono />
            <Tile label="proof size"   value="256 bytes" mono />
            <Tile label="verifier cu"  value="248k" mono />
            <Tile label="anchor slot"  value="245_002_400" mono />
          </div>
          <p className="mt-3 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            archive_root · <IdentifierMono value={PROOF.archiveRoot} size="xs" /> · settled at slot {PROOF.archiveRootSlot.toLocaleString()}
          </p>
          <AlertPill severity="execute" className="mt-3">on-chain anchor verified</AlertPill>
        </Panel>
      </div>

      <Panel surface="raised" density="dense">
        <header className="mb-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            30-day rebalance timeline · TVL
          </p>
        </header>
        <Sparkline values={TIMELINE} stroke="var(--color-accent-execute)" fill="var(--color-accent-execute)"
                   height={56} width={820} />
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
          <span>30d ago · ${TIMELINE[0]}M</span>
          <span>now · ${TIMELINE.at(-1)}M</span>
        </div>
      </Panel>
    </div>
  );
}

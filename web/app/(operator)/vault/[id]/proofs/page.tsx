// /vault/[id]/proofs — vault-scoped proof index (Phase 23 §4).

"use client";

import { use } from "react";
import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { VerifyInBrowser, type ProofShape } from "@/components/proofs/VerifyInBrowser";

const SAMPLE_PROOF: ProofShape = {
  publicInputHex: "00".repeat(268),
  proofBytes: Array.from({ length: 256 }, (_, i) => i & 0xff),
  archiveRootSlot: 245_000_000,
  archiveRoot: "a1".repeat(32),
  merkleProofPath: ["b2".repeat(32), "c3".repeat(32), "d4".repeat(32)],
};

interface ProofRow {
  slot: number;
  hash: string;
  pi_version: "v2" | "v3" | "v4";
  proof_size: number;
  verifier_cu: number;
  prover_id: string;
  age_s: number;
}

const ROWS: ProofRow[] = Array.from({ length: 16 }).map((_, i) => ({
  slot: 245_000_000 + i * 480,
  hash: ["a1b2c3d4", "e5f60718", "9081a2b3"][i % 3] + i.toString(16).padStart(56, "0"),
  pi_version: i % 5 === 4 ? "v4" : i % 7 === 6 ? "v3" : "v2",
  proof_size: 256,
  verifier_cu: 230_000 + (i % 6) * 8_000,
  prover_id: ["prover.iad.01", "prover.fra.07", "prover.sfo.03"][i % 3],
  age_s: 12 + i * 480,
}));

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="px-4 py-4 space-y-3">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">vault-scoped proofs</p>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-display text-[20px]">Proofs</h1>
          <IdentifierMono value={id} size="sm" />
          <span className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
            {ROWS.length} entries
          </span>
        </div>
      </header>

      <Panel surface="raised" density="dense">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-2 pr-2">slot</th>
              <th className="py-2 pr-2">public_input_hash</th>
              <th className="py-2 pr-2">version</th>
              <th className="py-2 pr-2 text-right">size</th>
              <th className="py-2 pr-2 text-right">verifier cu</th>
              <th className="py-2 pr-2">prover</th>
              <th className="py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.hash} className="border-t border-[color:var(--color-line-soft)] hover:bg-[color:var(--color-line-soft)]">
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.slot.toLocaleString()}</td>
                <td className="py-1.5 pr-2">
                  <Link href={`/vault/${id}/rebalances/${r.hash}`} className="hover:underline">
                    <IdentifierMono value={r.hash} size="xs" />
                  </Link>
                </td>
                <td className="py-1.5 pr-2">
                  <AlertPill severity={r.pi_version === "v4" ? "zk" : r.pi_version === "v3" ? "proof" : "info"}>
                    {r.pi_version}
                  </AlertPill>
                </td>
                <td className="py-1.5 pr-2 text-right">{r.proof_size}</td>
                <td className="py-1.5 pr-2 text-right">{(r.verifier_cu / 1_000).toFixed(0)}k</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.prover_id}</td>
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

// /proofs/live — Proof Explorer (Phase 21 §2.2).
// Phase 22 wires the live zk-pipeline lifecycle.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Proof Explorer · Atlas" };

export default function Page() {
  return (
    <div>
      <h1 className="text-display text-[40px] leading-[48px] mb-4">
        Proof Explorer
      </h1>
      <p className="text-[14px] text-[color:var(--color-ink-secondary)] mb-8">
        Live zk-proof pipeline: ingest → infer → consensus → prove →
        submit. Each rebalance produces a 268-byte (v2) / 300-byte (v3
        confidential) / 396-byte (v4 private execution) public input
        bound to a Groth16 receipt. Phase 22 streams the live feed.
      </p>
      <Panel surface="raised" density="default">
        <p className="font-mono text-[12px]">/api/v1/rebalance/{`{public_input_hash}`}/proof</p>
      </Panel>
    </div>
  );
}

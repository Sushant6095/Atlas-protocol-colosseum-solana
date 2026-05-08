// /docs/vault/proof-verification — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Verify a proof in your browser"
      description="Run the verifier client-side; trust no server."
      intro="The whole point of Atlas is that you do not have to trust us. Pick any rebalance receipt and verify it locally in your browser — sp1-solana through WASM, pure-JS public input layout, no calls home. This page walks the click path on /proofs/live and shows the underlying call."
    />
  );
}

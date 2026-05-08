// /docs/integrations/solana — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Solana"
      description="The substrate Atlas runs on."
      intro="Atlas is a Solana-native treasury OS. This page documents the runtime assumptions Atlas takes on Solana — the program model, the verifier-CPI primitive, the slot-bounded freshness budget, and the QUIC + gRPC paths through which the autonomous treasurer ingests state. If you are integrating Atlas into a Solana program, start with the verifier-CPI guide."
    />
  );
}

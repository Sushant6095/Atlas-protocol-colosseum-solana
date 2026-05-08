// /docs/vault/private-execution — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Private execution"
      description="MagicBlock PER for sensitive flow."
      intro="When the autonomous treasurer needs to route flow without revealing intent (large rebalance, MEV-sensitive moves), it can run inside a MagicBlock private execution room and settle to mainnet within a fixed slot budget. The settled receipt is verifiable like any other."
    />
  );
}

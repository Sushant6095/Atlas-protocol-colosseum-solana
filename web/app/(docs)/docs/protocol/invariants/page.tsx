// /docs/protocol/invariants — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Invariants I-1 through I-26"
      description="What the protocol promises, regardless of the strategy in flight."
      intro="Atlas ships with 26 invariants — properties that always hold no matter which strategy is loaded, which model is in use, or which venue is being routed to. A few examples: capital cannot leave the vault without a verified proof (I-3); a refused inference cannot become a settled action (I-9); a rebalance is atomic across venues (I-14)."
    />
  );
}

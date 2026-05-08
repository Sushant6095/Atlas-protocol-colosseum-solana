// /docs/how-it-works — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="How Atlas works"
      description="From your deposit to a verified rebalance, in plain language."
      intro="Atlas takes stablecoin deposits, picks the best place to park them, moves capital under a published policy, and ships a zero-knowledge proof every time it does. This page walks through that loop end-to-end without the math jargon — what each layer does, who can verify it, and what would have to break for your money to be at risk."
    />
  );
}

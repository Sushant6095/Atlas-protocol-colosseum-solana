// /docs/integrations/pyth — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Pyth"
      description="Pull oracle."
      intro="Pyth is the primary price oracle. Atlas pulls Pyth prices into the public input so every proof commits to the price the rebalance was decided on."
    />
  );
}

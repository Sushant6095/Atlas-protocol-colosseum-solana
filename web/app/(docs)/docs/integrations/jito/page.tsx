// /docs/integrations/jito — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Jito"
      description="Block engine."
      intro="Jito's block engine handles bundle inclusion. Atlas sends every rebalance bundle through Jito with a tip that auto-tunes against landing rate."
    />
  );
}

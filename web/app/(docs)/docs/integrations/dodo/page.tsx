// /docs/integrations/dodo — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Dodo Payments"
      description="Treasury payment rails."
      intro="Dodo Payments is the off-ramp for treasury payouts. Atlas hands signed payment instructions to Dodo, which settles to bank rails or stablecoin, with full ledger reconciliation."
    />
  );
}

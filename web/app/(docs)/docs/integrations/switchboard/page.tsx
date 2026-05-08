// /docs/integrations/switchboard — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Switchboard"
      description="On-Demand oracle."
      intro="Switchboard On-Demand is the secondary oracle. Atlas uses it as a divergence check against Pyth and as the primary feed for assets Pyth does not cover."
    />
  );
}

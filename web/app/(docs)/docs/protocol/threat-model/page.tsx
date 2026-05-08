// /docs/protocol/threat-model — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Threat model"
      description="Adversarial cases, what breaks, what doesn't."
      intro="We document the adversarial cases we have considered, the assumptions Atlas relies on, and the failure modes we have explicitly accepted. If you are reviewing Atlas for a security committee, start here."
    />
  );
}

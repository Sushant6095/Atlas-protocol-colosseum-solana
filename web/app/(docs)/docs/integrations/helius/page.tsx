// /docs/integrations/helius — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Helius"
      description="Yellowstone gRPC stream."
      intro="Helius is one of three gRPC quorum partners for state ingest. Atlas reads slot, account, and tx streams from Helius's Yellowstone endpoint."
    />
  );
}

// /docs/protocol/public-input — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Public input layout"
      description="The 268-byte v2 layout, byte by byte."
      intro="Every Atlas proof commits to a fixed-size public input. v2 is 268 bytes. This page documents each field, what it represents, why it's there, and how to construct one off-chain so your proof verifies on-chain on the first try."
    />
  );
}

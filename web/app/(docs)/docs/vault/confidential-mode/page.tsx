// /docs/vault/confidential-mode — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Confidential mode"
      description="Token-2022 confidential transfers for private positions."
      intro="Some depositors do not want their position size publicly observable. Confidential mode uses Token-2022 confidential transfers so positions are encrypted on-chain; viewing keys let auditors and the depositor decrypt their own balance."
    />
  );
}

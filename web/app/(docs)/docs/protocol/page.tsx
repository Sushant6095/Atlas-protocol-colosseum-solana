// /docs/protocol — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Atlas Protocol"
      description="The on-chain primitive: a verifier any program can CPI into."
      intro="Atlas Protocol is the on-chain core. It exposes one public good — a verifier-as-CPI — that any Solana program can call to confirm that a given inference was actually run, with the right model, on the right inputs, against the right policy. Everything else (vaults, treasury OS, dashboards) is built on top of this primitive."
    />
  );
}
